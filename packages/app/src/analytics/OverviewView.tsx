import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  CATEGORY_LABEL,
  MAJOR_CATEGORIES,
  MAJOR_CATEGORY_LABEL,
  majorCategoryOf,
  type MajorCategory,
} from '@seam/shared';
import {
  distributionBy,
  summarizeItems,
  type AnalyticsItem,
  type SoldAnalyticsItem,
} from '@seam/domain';
import { BarList, RankingList, StatCard, type BarListItem } from '../components';
import type { StatsSnapshot } from '../stats';
import { testIds } from '../utils/testIds';
import { formatDecimal, formatPercent, formatYen } from './format';
import { MetricRows, Section, SubHeading, cardsRow } from './layout';
import {
  BrandSection,
  ColorSection,
  FitSection,
  MaterialSection,
  PriceSection,
  RecentSpendSection,
  SaleSection,
  SummaryCards,
  WearRankingSection,
} from './sections';

type Props = {
  owned: readonly AnalyticsItem[];
  sold: readonly SoldAnalyticsItem[];
  snapshot: StatsSnapshot;
  onSelectMajor: (major: MajorCategory) => void;
};

export const OverviewView = ({ owned, sold, snapshot, onSelectMajor }: Props) => (
  <>
    <Section title="ワードローブ概要">
      <SummaryCards items={owned} />
      <View style={cardsRow}>
        <StatCard title="候補" value={snapshot.totals.wishlist} />
        <StatCard
          title="売却候補"
          value={snapshot.sellCandidates.length}
          tone={snapshot.sellCandidates.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="売却済み"
          value={snapshot.totals.sold}
          testID={testIds.stat.sold}
          onPress={
            snapshot.totals.sold > 0
              ? () => router.push({ pathname: '/(tabs)/closet', params: { mode: 'sold' } })
              : undefined
          }
        />
      </View>
    </Section>
    <CompositionSection owned={owned} onSelectMajor={onSelectMajor} />
    <RecentSpendSection items={owned} />
    <ColorSection items={owned} withHeatmap />
    <MaterialSection items={owned} />
    <BrandSection items={owned} />
    <PriceSection items={owned} />
    <FitSection items={owned} />
    <WearRankingSection items={owned} />
    <SaleSection sold={sold} />
    <DecisionSections snapshot={snapshot} />
  </>
);

const CompositionSection = ({
  owned,
  onSelectMajor,
}: {
  owned: readonly AnalyticsItem[];
  onSelectMajor: (major: MajorCategory) => void;
}) => {
  const { entries, totalAmount } = useMemo(() => {
    const dist = distributionBy(owned, (it) => majorCategoryOf(it.category), {
      order: MAJOR_CATEGORIES,
      includeEmpty: true,
    });
    // `other` (bags / accessories) only shows up once something is in it.
    const visible = dist.entries.filter((e) => e.key !== 'other' || e.count > 0);
    return { entries: visible, totalAmount: visible.reduce((a, e) => a + e.amount, 0) };
  }, [owned]);
  const rows = useMemo(
    () =>
      entries.map((e) => {
        const s = summarizeItems(owned.filter((it) => majorCategoryOf(it.category) === e.key));
        return {
          id: e.key,
          label: MAJOR_CATEGORY_LABEL[e.key],
          sublabel: `平均 ${formatYen(s.averagePrice)} · 着用 ${formatDecimal(s.averageWears)}回 · 未着用 ${formatPercent(s.unwornRate)}`,
          trailing: `${e.count}点`,
          onPress: () => onSelectMajor(e.key),
          testID: `row:analytics-major:${e.key}`,
        };
      }),
    [entries, owned, onSelectMajor],
  );

  return (
    <Section title="大分類の構成" testID="section:analytics-composition">
      <SubHeading>点数</SubHeading>
      <BarList
        items={entries.map((e) => ({
          label: MAJOR_CATEGORY_LABEL[e.key],
          value: e.count,
          valueLabel: `${e.count}点 ${formatPercent(e.share)}`,
        }))}
      />
      <SubHeading>金額</SubHeading>
      <BarList
        items={entries.map((e) => ({
          label: MAJOR_CATEGORY_LABEL[e.key],
          value: e.amount,
          valueLabel: `${formatYen(e.amount)} ${formatPercent(totalAmount === 0 ? null : e.amount / totalAmount)}`,
        }))}
      />
      <SubHeading>大分類ごとの指標（タップで詳細）</SubHeading>
      <MetricRows items={rows} />
    </Section>
  );
};

/** Purchase-decision and review sections carried over from the former Stats tab. */
const DecisionSections = ({ snapshot }: { snapshot: StatsSnapshot }) => {
  const ratioItems: BarListItem[] = (
    [
      ['Buy', snapshot.decisionRatio.buy],
      ['Watch', snapshot.decisionRatio.watch],
      ['Skip', snapshot.decisionRatio.skip],
      ['Lost', snapshot.decisionRatio.lost_auction],
    ] as const
  ).map(([label, ratio]) => ({
    label,
    value: Math.round(ratio * 100),
    valueLabel: formatPercent(ratio),
  }));

  return (
    <>
      <Section title="判断比率" subtitle="これまでの全 Decision を 100% で正規化">
        <BarList items={ratioItems} maxOverride={100} />
      </Section>

      <Section title="直近30日の判断">
        <View style={cardsRow}>
          <StatCard title="Buy" value={snapshot.recentBuyDecisions} tone="good" />
          <StatCard title="Watch" value={snapshot.recentWatchDecisions} />
          <StatCard title="Skip" value={snapshot.recentSkipDecisions} tone="warning" />
        </View>
      </Section>

      <Section title="着ていない服" subtitle="購入後30日以上で着用 0 回">
        <RankingList
          items={snapshot.unworn.map((u) => ({
            id: u.id,
            label: u.name,
            sublabel: `${u.daysSincePurchase} 日経過`,
            trailing: '0回',
            onPress: () => router.push({ pathname: '/item/[id]', params: { id: u.id } }),
          }))}
          emptyMessage="着ていない服はありません 🎉"
        />
      </Section>

      <Section title="重複の可能性" subtitle="同じカテゴリ × ブランド × 色">
        <RankingList
          items={snapshot.duplicateClusters.map((c, idx) => {
            const parts = [CATEGORY_LABEL[c.category], c.brand, c.color].filter((p): p is string =>
              Boolean(p),
            );
            return {
              id: `${c.category}-${c.brand ?? '-'}-${c.color ?? '-'}-${idx}`,
              label: parts.join(' · '),
              sublabel: `${c.itemIds.length} 件`,
              trailing: `${c.itemIds.length}件`,
            };
          })}
          emptyMessage="重複の可能性は見つかりませんでした"
        />
      </Section>

      <Section title="Cost Per Wear が高い服" subtitle="単価が高くて着ていない順">
        <RankingList
          items={snapshot.highCpwItems.map((i) => ({
            id: i.id,
            label: i.name,
            sublabel: `着用 ${i.wearCount} 回`,
            trailing: formatYen(i.cpw),
            onPress: () => router.push({ pathname: '/item/[id]', params: { id: i.id } }),
          }))}
          emptyMessage="CPW を計算できるアイテムがまだありません"
        />
      </Section>

      <Section title="失敗理由ランキング">
        <RankingList
          items={snapshot.failureReasonRanking.map((r) => ({
            id: r.reason,
            label: r.label,
            trailing: `${r.count}件`,
          }))}
          emptyMessage="失敗ログがまだありません"
        />
      </Section>
    </>
  );
};
