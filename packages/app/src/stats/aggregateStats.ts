import {
  CANDIDATE_STATUSES,
  CATEGORY_LABEL,
  FAILURE_REASON_LABEL,
  type DecisionKind,
  type FailureReason,
  type GarmentCategory,
  type GarmentItem,
} from '@seam/shared';
import { calculateCostPerWear } from '@seam/domain';
import {
  decisionLogRepository,
  failureLogRepository,
  itemRepository,
  wearLogRepository,
} from '../repositories';
import {
  averagePurchasePrice,
  daysSince,
  findDuplicateClusters,
  monthlyPurchaseBuckets,
  toDecisionRatio,
  topNCounts,
  type DuplicateCluster,
} from './aggregators';

const RECENT_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_WINDOW = 12;
const TOP_N_BRAND_COLOR = 10;
const TOP_N_RANKINGS = 10;

export type StatsSnapshot = {
  totals: {
    owned: number;
    wishlist: number;
    sold: number;
    skipped: number;
  };
  byCategory: Array<{ category: GarmentCategory; count: number; label: string }>;
  byBrand: Array<{ brand: string; count: number }>;
  byColor: Array<{ color: string; count: number }>;
  monthlyPurchase: Array<{ month: string; count: number; amount: number }>;
  avgPurchasePrice: number;
  recentBuyDecisions: number;
  recentSkipDecisions: number;
  recentWatchDecisions: number;
  decisionRatio: Record<DecisionKind, number>;
  unworn: Array<{ id: string; name: string; daysSincePurchase: number }>;
  sellCandidates: Array<{ id: string; name: string }>;
  duplicateClusters: DuplicateCluster[];
  highCpwItems: Array<{ id: string; name: string; cpw: number; wearCount: number }>;
  failureReasonRanking: Array<{ reason: FailureReason; label: string; count: number }>;
};

const inLastNDays = (iso: string, now: Date, days: number): boolean => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return now.getTime() - d.getTime() <= days * MS_PER_DAY;
};

/**
 * Aggregate every Stats screen metric in one pass.
 *
 * Side effects: reads from the local SQLite DB via the existing repositories.
 * No writes, no network. The result is a plain JSON-shaped object suitable
 * for direct rendering.
 */
export const aggregateStats = async (): Promise<StatsSnapshot> => {
  const now = new Date();

  const [allItems, allDecisions, reasonCounts, decisionCounts] = await Promise.all([
    itemRepository.list({}),
    decisionLogRepository.listAll(),
    failureLogRepository.countByReason(),
    decisionLogRepository.countByDecision(),
  ]);

  const owned = allItems.filter((it) => it.status === 'owned');
  const wishlist = allItems.filter((it) =>
    (CANDIDATE_STATUSES as readonly string[]).includes(it.status),
  );
  const sold = allItems.filter((it) => it.status === 'sold');
  const skipped = allItems.filter((it) => it.status === 'skipped');

  // Category histogram across owned items.
  const byCategoryMap = new Map<GarmentCategory, number>();
  for (const it of owned) {
    byCategoryMap.set(it.category, (byCategoryMap.get(it.category) ?? 0) + 1);
  }
  const byCategory = Array.from(byCategoryMap, ([category, count]) => ({
    category,
    count,
    label: CATEGORY_LABEL[category],
  })).sort((a, b) => b.count - a.count);

  const byBrand = topNCounts(owned, (it) => it.brand, TOP_N_BRAND_COLOR).map((b) => ({
    brand: b.key,
    count: b.count,
  }));
  const byColor = topNCounts(owned, (it) => it.color, TOP_N_BRAND_COLOR).map((c) => ({
    color: c.key,
    count: c.count,
  }));

  const monthlyPurchase = monthlyPurchaseBuckets(owned, now, MONTHS_WINDOW);
  const avgPurchasePrice = averagePurchasePrice(owned);

  // Recent decision counts (last 30d).
  let recentBuy = 0;
  let recentWatch = 0;
  let recentSkip = 0;
  for (const d of allDecisions) {
    if (!inLastNDays(d.createdAt, now, RECENT_WINDOW_DAYS)) continue;
    if (d.decision === 'buy') recentBuy += 1;
    else if (d.decision === 'watch') recentWatch += 1;
    else if (d.decision === 'skip') recentSkip += 1;
  }

  const decisionRatio = toDecisionRatio(decisionCounts);

  // Unworn: owned + 0 wear logs + purchaseDate >= 30 days ago.
  // Newly purchased items still in their grace period are excluded so the
  // list focuses on actually-neglected pieces.
  const ownedIds = owned.map((it) => it.id);
  const wearCounts = await wearLogRepository.countsByItems(ownedIds);
  const unwornCandidates = owned
    .map((it) => {
      const days = daysSince(it.purchaseDate, now);
      const wears = wearCounts[it.id] ?? 0;
      if (wears !== 0) return null;
      if (days === null || days < RECENT_WINDOW_DAYS) return null;
      return { id: it.id, name: it.name, daysSincePurchase: days };
    })
    .filter((v): v is { id: string; name: string; daysSincePurchase: number } => v !== null)
    .sort((a, b) => b.daysSincePurchase - a.daysSincePurchase)
    .slice(0, TOP_N_RANKINGS);

  const sellCandidates = allItems
    .filter((it) => it.isSellCandidate && it.status === 'owned')
    .map((it) => ({ id: it.id, name: it.name }));

  const duplicateClusters = findDuplicateClusters(allItems);

  // CPW ranking (high CPW = bad value). Excludes items with 0 wears since
  // their CPW is undefined; "未着用" already covers that bucket above.
  const cpwItems: Array<{ id: string; name: string; cpw: number; wearCount: number }> = [];
  for (const it of owned) {
    const wears = wearCounts[it.id] ?? 0;
    if (wears === 0) continue;
    const cpw = calculateCostPerWear(it.totalPrice ?? it.purchasePrice, wears);
    if (cpw === null || cpw === 0) continue;
    cpwItems.push({ id: it.id, name: it.name, cpw, wearCount: wears });
  }
  cpwItems.sort((a, b) => b.cpw - a.cpw);
  const highCpwItems = cpwItems.slice(0, TOP_N_RANKINGS);

  const failureReasonRanking = (Object.entries(reasonCounts) as Array<[FailureReason, number]>)
    .filter(([, n]) => n > 0)
    .map(([reason, count]) => ({
      reason,
      label: FAILURE_REASON_LABEL[reason],
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N_RANKINGS);

  return {
    totals: {
      owned: owned.length,
      wishlist: wishlist.length,
      sold: sold.length,
      skipped: skipped.length,
    },
    byCategory,
    byBrand,
    byColor,
    monthlyPurchase,
    avgPurchasePrice,
    recentBuyDecisions: recentBuy,
    recentSkipDecisions: recentSkip,
    recentWatchDecisions: recentWatch,
    decisionRatio,
    unworn: unwornCandidates,
    sellCandidates,
    duplicateClusters,
    highCpwItems,
    failureReasonRanking,
  };
};

/**
 * Lightweight summary used by the Home tab. Avoids loading every
 * aggregation when only the current month's purchase total is needed.
 */
export type MonthlyPurchaseSummary = {
  month: string; // YYYY-MM
  count: number;
  amount: number;
};

export const getMonthlyPurchaseSummary = async (
  now: Date = new Date(),
): Promise<MonthlyPurchaseSummary> => {
  const owned: GarmentItem[] = await itemRepository.listOwned();
  const buckets = monthlyPurchaseBuckets(owned, now, 1);
  return buckets[0] ?? { month: '', count: 0, amount: 0 };
};
