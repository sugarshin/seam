import { useMemo, useState } from 'react';
import { ScrollView, Text, View, type ViewStyle } from 'react-native';
import {
  CATEGORY_LABEL,
  MAJOR_CATEGORY_LABEL,
  MEASUREMENT_KEY_LABEL,
  categoriesOfMajor,
  majorCategoryOf,
  type MajorCategory,
  type MeasurementKey,
} from '@seam/shared';
import {
  distributionBy,
  measurementKeysForMajor,
  sizeFeelByLabel,
  summarizeMeasurements,
  type AnalyticsItem,
  type MeasurementSummary,
  type SoldAnalyticsItem,
} from '@seam/domain';
import { BarList, Chip, RangeBar, RangeBarLegend } from '../components';
import { type ColorPalette, font, space, useThemeColors } from '../theme';
import { formatMeasurement, formatPercent } from './format';
import { MetricRows, Note, Section } from './layout';
import {
  BrandSection,
  ColorSection,
  FitSection,
  MaterialSection,
  PriceSection,
  SaleSection,
  SizeLabelSection,
  SummaryCards,
  WearRankingSection,
} from './sections';

type Props = {
  major: MajorCategory;
  owned: readonly AnalyticsItem[];
  sold: readonly SoldAnalyticsItem[];
};

export const MajorCategoryView = ({ major, owned, sold }: Props) => {
  const items = useMemo(
    () => owned.filter((it) => majorCategoryOf(it.category) === major),
    [owned, major],
  );
  const soldItems = useMemo(
    () => sold.filter((it) => majorCategoryOf(it.category) === major),
    [sold, major],
  );
  const label = MAJOR_CATEGORY_LABEL[major];

  if (items.length === 0 && soldItems.length === 0) {
    return (
      <Section title={label}>
        <Note>{`${label}のアイテムはまだありません`}</Note>
      </Section>
    );
  }

  return (
    <>
      <Section title={`${label}の概要`}>
        <SummaryCards items={items} />
      </Section>
      <SubcategorySection major={major} items={items} />
      <MeasurementSection major={major} items={items} />
      <ColorSection items={items} />
      <MaterialSection items={items} />
      <BrandSection items={items} />
      <SizeLabelSection items={items} />
      <PriceSection items={items} />
      <FitSection items={items} />
      <WearRankingSection items={items} />
      <SaleSection sold={soldItems} />
    </>
  );
};

const SubcategorySection = ({
  major,
  items,
}: {
  major: MajorCategory;
  items: readonly AnalyticsItem[];
}) => {
  const dist = useMemo(() => distributionBy(items, (it) => it.category), [items]);
  return (
    <Section
      title="内訳"
      subtitle={categoriesOfMajor(major)
        .map((c) => CATEGORY_LABEL[c])
        .join(' / ')}
      testID="section:analytics-subcategory"
    >
      <BarList
        items={dist.entries.map((e) => ({
          label: CATEGORY_LABEL[e.key],
          value: e.count,
          valueLabel: `${e.count}点 ${formatPercent(e.share)}`,
        }))}
      />
    </Section>
  );
};

const MeasurementSection = ({
  major,
  items,
}: {
  major: MajorCategory;
  items: readonly AnalyticsItem[];
}) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const summaries = useMemo(
    () => summarizeMeasurements(items, measurementKeysForMajor(major)),
    [items, major],
  );
  if (measurementKeysForMajor(major).length === 0) return null;

  return (
    <>
      <Section
        title="実寸"
        subtitle="ジャスト範囲 = フィット評価「ジャスト」または基準服に設定したアイテムの実寸"
        testID="section:analytics-measurements"
      >
        {summaries.length === 0 ? (
          <Note>実寸が登録されたアイテムがありません</Note>
        ) : (
          <>
            <RangeBarLegend fitLabel="ジャスト範囲" />
            {summaries.map((s) => {
              const fmt = (v: number) => formatMeasurement(v, s.unit);
              return (
                <View key={s.key} style={styles.measureRow}>
                  <View style={headerRow}>
                    <Text style={styles.measureLabel}>{MEASUREMENT_KEY_LABEL[s.key]}</Text>
                    <Text style={styles.measureValue}>
                      {`中央値 ${fmt(s.median)} · ${s.count}点`}
                    </Text>
                  </View>
                  <RangeBar
                    min={s.min}
                    p25={s.p25}
                    median={s.median}
                    p75={s.p75}
                    max={s.max}
                    fit={s.fit}
                    format={fmt}
                    testID={`range:analytics-measure:${s.key}`}
                  />
                  <Text style={styles.fitText}>
                    {s.fit
                      ? `ジャスト範囲 ${fmt(s.fit.min)}〜${fmt(s.fit.max)} (${s.fit.count}点)`
                      : 'ジャスト評価の実寸はまだありません'}
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </Section>
      {summaries.length > 0 && <SizeFeelSection items={items} summaries={summaries} />}
    </>
  );
};

const SizeFeelSection = ({
  items,
  summaries,
}: {
  items: readonly AnalyticsItem[];
  summaries: readonly MeasurementSummary[];
}) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const keys = summaries.map((s) => s.key);
  const [selected, setSelected] = useState<MeasurementKey | null>(null);
  const key = selected !== null && keys.includes(selected) ? selected : keys[0];
  const feel = useMemo(() => (key ? sizeFeelByLabel(items, key) : null), [items, key]);
  if (!key || !feel) return null;
  const fmt = (v: number) => (feel.unit ? formatMeasurement(v, feel.unit) : String(v));

  return (
    <Section
      title="ブランド別サイズ感"
      subtitle="同じサイズ表記でブランドごとに実寸がどれだけ違うか"
      testID="section:analytics-size-feel"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={chipRow}>
          {keys.map((k) => (
            <Chip
              key={k}
              label={MEASUREMENT_KEY_LABEL[k]}
              selected={k === key}
              onPress={() => setSelected(k)}
              testID={`chip:analytics-size-feel:${k}`}
            />
          ))}
        </View>
      </ScrollView>
      {feel.groups.length === 0 ? (
        <Note>ブランド・サイズ表記・実寸がそろったアイテムがありません</Note>
      ) : (
        feel.groups.map((g) => (
          <View key={g.sizeLabel} style={{ gap: 2 }}>
            <Text style={styles.groupTitle}>
              {[
                g.sizeLabel,
                `中央値 ${fmt(g.median)}`,
                g.spread === null ? null : `ブランド差 ${fmt(g.spread)}`,
              ]
                .filter((s): s is string => s !== null)
                .join(' · ')}
            </Text>
            <MetricRows
              items={g.brands.map((b) => ({
                id: `${g.sizeLabel}:${b.brandKey}`,
                label: b.brand,
                sublabel: `${b.count}点`,
                trailing: fmt(b.median),
              }))}
            />
          </View>
        ))
      )}
    </Section>
  );
};

const headerRow: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: space.sm,
};

const chipRow: ViewStyle = {
  flexDirection: 'row',
  gap: space.xs,
};

const makeStyles = (p: ColorPalette) => ({
  measureRow: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  measureLabel: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: p.text,
  } as const,
  measureValue: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  fitText: {
    fontSize: font.size.xs,
    color: p.text,
  } as const,
  groupTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: p.text,
    marginTop: space.sm,
  } as const,
});
