import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { CATEGORY_LABEL } from '@seam/shared';
import { BarList, RankingList, StatCard, type BarListItem } from '../../src/components';
import { aggregateStats, type StatsSnapshot } from '../../src/stats';
import { colors, font, space } from '../../src/theme';

export default function StatsScreen() {
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await aggregateStats();
      setSnapshot(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (snapshot === null) {
    return (
      <View style={loadingWrap}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : error !== null ? (
          <Text style={errorStyle}>集計に失敗しました: {error}</Text>
        ) : (
          <Text style={mutedStyle}>—</Text>
        )}
      </View>
    );
  }

  const { totals } = snapshot;
  const unwornCount = snapshot.unworn.length;

  const ratioItems: BarListItem[] = [
    {
      label: 'Buy',
      value: Math.round(snapshot.decisionRatio.buy * 100),
      valueLabel: `${Math.round(snapshot.decisionRatio.buy * 100)}%`,
    },
    {
      label: 'Watch',
      value: Math.round(snapshot.decisionRatio.watch * 100),
      valueLabel: `${Math.round(snapshot.decisionRatio.watch * 100)}%`,
    },
    {
      label: 'Skip',
      value: Math.round(snapshot.decisionRatio.skip * 100),
      valueLabel: `${Math.round(snapshot.decisionRatio.skip * 100)}%`,
    },
    {
      label: 'Lost',
      value: Math.round(snapshot.decisionRatio.lost_auction * 100),
      valueLabel: `${Math.round(snapshot.decisionRatio.lost_auction * 100)}%`,
    },
  ];

  const categoryItems: BarListItem[] = snapshot.byCategory.map((c) => ({
    label: c.label,
    value: c.count,
  }));

  const brandItems: BarListItem[] = snapshot.byBrand.map((b) => ({
    label: b.brand,
    value: b.count,
  }));

  const colorItems: BarListItem[] = snapshot.byColor.map((c) => ({
    label: c.color,
    value: c.count,
  }));

  const monthlyItems: BarListItem[] = snapshot.monthlyPurchase.map((m) => ({
    label: m.month,
    value: m.amount,
    valueLabel: `¥${m.amount.toLocaleString()}`,
  }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl }}
      refreshControl={undefined}
    >
      <Section title="ワードローブ概要">
        <View style={cardsRow}>
          <StatCard title="所有数" value={totals.owned} subtext={`未着用 ${unwornCount}`} />
          <StatCard title="候補" value={totals.wishlist} />
          <StatCard
            title="売却候補"
            value={snapshot.sellCandidates.length}
            tone={snapshot.sellCandidates.length > 0 ? 'warning' : 'default'}
          />
          <StatCard title="売却済み" value={totals.sold} />
        </View>
      </Section>

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

      <Section title="カテゴリ別所有数">
        <BarList items={categoryItems} emptyMessage="所有しているアイテムがありません" />
      </Section>

      <Section title="ブランド別所有数 (Top 10)">
        <BarList items={brandItems} emptyMessage="ブランド情報のあるアイテムがありません" />
      </Section>

      <Section title="色別所有数 (Top 10)">
        <BarList items={colorItems} emptyMessage="色情報のあるアイテムがありません" />
      </Section>

      <Section title="月別購入金額" subtitle="直近12ヶ月">
        <BarList items={monthlyItems} />
      </Section>

      <Section title="平均購入価格">
        <View style={cardsRow}>
          <StatCard
            title="購入1点あたり"
            value={`¥${snapshot.avgPurchasePrice.toLocaleString()}`}
            subtext={`${totals.owned} 点平均`}
          />
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
            trailing: `¥${Math.round(i.cpw).toLocaleString()}`,
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
    </ScrollView>
  );
}

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <View style={{ gap: space.sm }}>
    <View>
      <Text style={sectionTitle}>{title}</Text>
      {subtitle !== undefined && <Text style={sectionSubtitle}>{subtitle}</Text>}
    </View>
    {children}
  </View>
);

const cardsRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.sm,
};

const loadingWrap: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.bg,
};

const sectionTitle = {
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  color: colors.text,
} as const;

const sectionSubtitle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  marginTop: 2,
} as const;

const mutedStyle = {
  color: colors.textMuted,
  fontSize: font.size.sm,
} as const;

const errorStyle = {
  color: colors.warning,
  fontSize: font.size.sm,
  paddingHorizontal: space.lg,
  textAlign: 'center' as const,
} as const;
