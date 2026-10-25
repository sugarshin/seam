import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  COLOR_FAMILY_LABEL,
  COLOR_FAMILY_SWATCH,
  FIT_RATING_LABEL,
  FitRatingSchema,
  MAJOR_CATEGORIES,
  MAJOR_CATEGORY_LABEL,
  MATERIAL_FAMILY_LABEL,
  majorCategoryOf,
} from '@seam/shared';
import {
  brandStats,
  crossTabulate,
  distributionBy,
  monthlyByMajorCategory,
  normalizeColor,
  normalizeMaterial,
  normalizeSizeLabel,
  priceBandDistribution,
  rankByWears,
  summarizeItems,
  summarizeSales,
  type AnalyticsItem,
  type SoldAnalyticsItem,
} from '@seam/domain';
import { BarList, HeatmapGrid, RankingList, StatCard } from '../components';
import { formatDecimal, formatPercent, formatYen } from './format';
import { Note, Section, SubHeading, cardsRow } from './layout';

const MONTHS_WINDOW = 12;
const TOP_N = 10;
const UNRECOGNIZED_SAMPLES = 5;

/** Distinct raw values that were entered but could not be classified. */
const unrecognized = (
  items: readonly AnalyticsItem[],
  raw: (it: AnalyticsItem) => string | undefined,
  classify: (value: string) => unknown,
): string[] => {
  const out = new Set<string>();
  for (const it of items) {
    const value = raw(it)?.trim();
    if (value && classify(value) === null) out.add(value);
  }
  return Array.from(out).slice(0, UNRECOGNIZED_SAMPLES);
};

const unknownNote = (unknownCount: number, samples: readonly string[], what: string): string => {
  const base = `${what}未入力・判定できないもの ${unknownCount} 点`;
  return samples.length > 0 ? `${base}（判定できなかった表記: ${samples.join(' / ')}）` : base;
};

export const SummaryCards = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const s = useMemo(() => summarizeItems(items), [items]);
  return (
    <View style={cardsRow}>
      <StatCard
        title="点数"
        value={s.count}
        subtext={`未着用 ${s.unwornCount} (${formatPercent(s.unwornRate)})`}
      />
      <StatCard
        title="総額"
        value={formatYen(s.totalAmount)}
        subtext={`平均 ${formatYen(s.averagePrice)} / 中央値 ${formatYen(s.medianPrice)}`}
      />
      <StatCard
        title="平均着用"
        value={`${formatDecimal(s.averageWears)}回`}
        subtext={`1回あたり ${formatYen(s.costPerWear)}`}
      />
      <StatCard
        title="お気に入り"
        value={s.averageFavorite === null ? '—' : `★${formatDecimal(s.averageFavorite)}`}
        subtext={`ジャスト率 ${formatPercent(s.justFitRate)}`}
      />
    </View>
  );
};

export const ColorSection = ({
  items,
  withHeatmap = false,
}: {
  items: readonly AnalyticsItem[];
  withHeatmap?: boolean;
}) => {
  const dist = useMemo(() => distributionBy(items, (it) => normalizeColor(it.color)), [items]);
  const samples = useMemo(() => unrecognized(items, (it) => it.color, normalizeColor), [items]);
  const table = useMemo(
    () =>
      withHeatmap
        ? crossTabulate(
            items,
            (it) => normalizeColor(it.color),
            (it) => majorCategoryOf(it.category),
            { colOrder: MAJOR_CATEGORIES },
          )
        : null,
    [items, withHeatmap],
  );
  return (
    <Section title="色" subtitle="表記ゆれを色系統にまとめて集計" testID="section:analytics-color">
      <BarList
        items={dist.entries.map((e) => ({
          label: COLOR_FAMILY_LABEL[e.key],
          value: e.count,
          valueLabel: `${e.count}点 ${formatPercent(e.share)}`,
          swatch: COLOR_FAMILY_SWATCH[e.key],
        }))}
        emptyMessage="色が入力されたアイテムがありません"
      />
      {dist.unknownCount > 0 && <Note>{unknownNote(dist.unknownCount, samples, '色')}</Note>}
      {table && table.rows.length > 0 && (
        <>
          <SubHeading>色 × 大分類</SubHeading>
          <HeatmapGrid
            rowLabels={table.rows.map((r) => COLOR_FAMILY_LABEL[r])}
            rowSwatches={table.rows.map((r) => COLOR_FAMILY_SWATCH[r])}
            colLabels={table.cols.map((c) => MAJOR_CATEGORY_LABEL[c])}
            counts={table.counts}
            max={table.max}
            testID="heatmap:analytics-color-major"
          />
        </>
      )}
    </Section>
  );
};

export const MaterialSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const dist = useMemo(
    () => distributionBy(items, (it) => normalizeMaterial(it.material)),
    [items],
  );
  const samples = useMemo(
    () => unrecognized(items, (it) => it.material, normalizeMaterial),
    [items],
  );
  return (
    <Section title="素材" subtitle="混率が最も高い素材で集計" testID="section:analytics-material">
      <BarList
        items={dist.entries.map((e) => ({
          label: MATERIAL_FAMILY_LABEL[e.key],
          value: e.count,
          valueLabel: `${e.count}点 ${formatPercent(e.share)}`,
        }))}
        emptyMessage="素材が入力されたアイテムがありません"
      />
      {dist.unknownCount > 0 && <Note>{unknownNote(dist.unknownCount, samples, '素材')}</Note>}
    </Section>
  );
};

export const BrandSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const stats = useMemo(() => brandStats(items), [items]);
  return (
    <Section
      title={`ブランド (Top ${TOP_N})`}
      subtitle={stats.length > 0 ? `全 ${stats.length} ブランド` : undefined}
      testID="section:analytics-brand"
    >
      <RankingList
        items={stats.slice(0, TOP_N).map((b) => ({
          id: b.key,
          label: b.label,
          sublabel: [
            `平均 ${formatYen(b.averagePrice)}`,
            `着用 ${formatDecimal(b.averageWears)}回`,
            b.averageFavorite === null ? null : `★${formatDecimal(b.averageFavorite)}`,
          ]
            .filter((s): s is string => s !== null)
            .join(' · '),
          trailing: `${b.count}点`,
        }))}
        emptyMessage="ブランドが入力されたアイテムがありません"
      />
    </Section>
  );
};

export const SizeLabelSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const dist = useMemo(
    () => distributionBy(items, (it) => normalizeSizeLabel(it.sizeLabel)),
    [items],
  );
  return (
    <Section title="サイズ表記" testID="section:analytics-size-label">
      <BarList
        items={dist.entries.slice(0, TOP_N).map((e) => ({
          label: e.key,
          value: e.count,
          valueLabel: `${e.count}点 ${formatPercent(e.share)}`,
        }))}
        emptyMessage="サイズ表記が入力されたアイテムがありません"
      />
    </Section>
  );
};

export const PriceSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const dist = useMemo(() => priceBandDistribution(items), [items]);
  const months = useMemo(() => monthlyByMajorCategory(items, new Date(), MONTHS_WINDOW), [items]);
  return (
    <Section title="価格" testID="section:analytics-price">
      <SubHeading>価格帯</SubHeading>
      <BarList
        items={dist.entries.map((e) => ({
          label: e.key,
          value: e.count,
          valueLabel: `${e.count}点`,
        }))}
      />
      {dist.unknownCount > 0 && <Note>{`価格未入力 ${dist.unknownCount} 点`}</Note>}
      <SubHeading>{`月別購入金額 (直近${MONTHS_WINDOW}ヶ月)`}</SubHeading>
      <BarList
        items={months.map((m) => ({
          label: m.month,
          value: m.amount,
          valueLabel: formatYen(m.amount),
        }))}
      />
    </Section>
  );
};

/** Spend per major category over the monthly window (overview only). */
export const RecentSpendSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const totals = useMemo(() => {
    const months = monthlyByMajorCategory(items, new Date(), MONTHS_WINDOW);
    return MAJOR_CATEGORIES.map((major) => {
      let count = 0;
      let amount = 0;
      for (const m of months) {
        count += m.byMajor[major].count;
        amount += m.byMajor[major].amount;
      }
      return { major, count, amount };
    }).filter((t) => t.count > 0);
  }, [items]);
  return (
    <Section
      title={`直近${MONTHS_WINDOW}ヶ月で買ったもの`}
      subtitle="購入日ベースの大分類別金額"
      testID="section:analytics-recent-spend"
    >
      <BarList
        items={totals.map((t) => ({
          label: MAJOR_CATEGORY_LABEL[t.major],
          value: t.amount,
          valueLabel: `${formatYen(t.amount)} (${t.count}点)`,
        }))}
        emptyMessage={`直近${MONTHS_WINDOW}ヶ月の購入はありません`}
      />
    </Section>
  );
};

export const FitSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const dist = useMemo(
    () =>
      distributionBy(items, (it) => it.fitRating, {
        order: FitRatingSchema.options,
        includeEmpty: true,
      }),
    [items],
  );
  const summary = useMemo(() => summarizeItems(items), [items]);
  return (
    <Section
      title="フィット評価"
      subtitle={`評価済み ${summary.fitRatedCount} 点 · ジャスト率 ${formatPercent(summary.justFitRate)}`}
      testID="section:analytics-fit"
    >
      <BarList
        items={dist.entries.map((e) => ({
          label: FIT_RATING_LABEL[e.key],
          value: e.count,
          valueLabel: `${e.count}点`,
        }))}
      />
    </Section>
  );
};

export const WearRankingSection = ({ items }: { items: readonly AnalyticsItem[] }) => {
  const ranked = useMemo(() => rankByWears(items, 5), [items]);
  return (
    <Section title="よく着ている服 (Top 5)" testID="section:analytics-wear">
      <RankingList
        items={ranked.map((it) => ({
          id: it.id,
          label: it.name,
          sublabel: [it.brand, it.color].filter(Boolean).join(' · '),
          trailing: `${it.wearCount}回`,
          onPress: () => router.push({ pathname: '/item/[id]', params: { id: it.id } }),
        }))}
        emptyMessage="着用記録がまだありません"
      />
    </Section>
  );
};

export const SaleSection = ({ sold }: { sold: readonly SoldAnalyticsItem[] }) => {
  const s = useMemo(() => summarizeSales(sold), [sold]);
  if (s.count === 0) {
    return (
      <Section title="売却" testID="section:analytics-sale">
        <Note>売却済みのアイテムはまだありません</Note>
      </Section>
    );
  }
  return (
    <Section
      title="売却"
      subtitle={`購入額・売却額がそろった ${s.pricedCount} 点で損益を計算`}
      testID="section:analytics-sale"
    >
      <View style={cardsRow}>
        <StatCard title="売却数" value={s.count} />
        <StatCard title="売上" value={formatYen(s.totalProceeds)} />
        <StatCard
          title="損益"
          value={`${s.profit >= 0 ? '+' : '−'}${formatYen(Math.abs(s.profit))}`}
          tone={s.profit >= 0 ? 'good' : 'warning'}
        />
        <StatCard title="回収率" value={formatPercent(s.recoveryRate)} />
      </View>
    </Section>
  );
};
