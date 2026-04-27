import { useCallback, useState } from 'react';
import { ScrollView, Text, View, type ViewStyle } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { CANDIDATE_STATUSES, type CandidateInfo, type GarmentItem } from '@seam/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { ItemCard } from '../../src/components/ItemCard';
import { candidateInfoRepository, itemRepository, photoRepository } from '../../src/repositories';
import { getMonthlyPurchaseSummary } from '../../src/stats';
import { colors, font, space, useThemeColors } from '../../src/theme';

const TOP_N = 5;

type CandidateCard = {
  item: GarmentItem;
  candidate: CandidateInfo;
};

export default function HomeScreen() {
  const palette = useThemeColors();
  const [recentOwned, setRecentOwned] = useState<GarmentItem[]>([]);
  const [recentWishlist, setRecentWishlist] = useState<GarmentItem[]>([]);
  const [endingToday, setEndingToday] = useState<CandidateCard[]>([]);
  const [endingSoon, setEndingSoon] = useState<CandidateCard[]>([]);
  const [overBudget, setOverBudget] = useState<CandidateCard[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string | undefined>>({});
  const [monthSpend, setMonthSpend] = useState(0);
  const [monthCount, setMonthCount] = useState(0);

  const load = useCallback(async () => {
    const owned = await itemRepository.list({ statuses: ['owned'] }, 'createdAt_desc');
    const wishlist = await itemRepository.list({ statuses: CANDIDATE_STATUSES }, 'createdAt_desc');
    const ownedTop = owned.slice(0, TOP_N);
    const wishTop = wishlist.slice(0, TOP_N);
    setRecentOwned(ownedTop);
    setRecentWishlist(wishTop);

    // Pull candidate info for every active wishlist item to surface alerts.
    const candidates: CandidateCard[] = [];
    await Promise.all(
      wishlist.map(async (it) => {
        const c = await candidateInfoRepository.getByItemId(it.id);
        if (c) candidates.push({ item: it, candidate: c });
      }),
    );

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const in24h = now.getTime() + 24 * 60 * 60 * 1000;

    const today: CandidateCard[] = [];
    const soon: CandidateCard[] = [];
    const over: CandidateCard[] = [];
    for (const cc of candidates) {
      const ends = cc.candidate.auctionEndsAt;
      if (ends) {
        const d = new Date(ends);
        if (!Number.isNaN(d.getTime()) && d.getTime() >= now.getTime()) {
          if (ends.startsWith(todayKey)) today.push(cc);
          else if (d.getTime() <= in24h) soon.push(cc);
        }
      }
      if (
        cc.candidate.maxBidPrice !== undefined &&
        cc.candidate.totalPrice !== undefined &&
        cc.candidate.totalPrice > cc.candidate.maxBidPrice
      ) {
        over.push(cc);
      }
    }
    today.sort((a, b) =>
      (a.candidate.auctionEndsAt ?? '').localeCompare(b.candidate.auctionEndsAt ?? ''),
    );
    soon.sort((a, b) =>
      (a.candidate.auctionEndsAt ?? '').localeCompare(b.candidate.auctionEndsAt ?? ''),
    );
    setEndingToday(today);
    setEndingSoon(soon);
    setOverBudget(over);

    const thumbMap: Record<string, string | undefined> = {};
    const allItems = [
      ...ownedTop,
      ...wishTop,
      ...today.map((c) => c.item),
      ...soon.map((c) => c.item),
      ...over.map((c) => c.item),
    ];
    const dedup = Array.from(new Map(allItems.map((it) => [it.id, it])).values());
    await Promise.all(
      dedup.map(async (it) => {
        const photos = await photoRepository.listByItem(it.id);
        thumbMap[it.id] = photos[0]?.thumbnailRelativePath ?? photos[0]?.relativePath;
      }),
    );
    setThumbnails(thumbMap);

    // Month spend / count are sourced from the shared stats helper to keep
    // Home and Stats consistent when one changes.
    const monthly = await getMonthlyPurchaseSummary(now);
    setMonthSpend(monthly.amount);
    setMonthCount(monthly.count);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goToCandidate = (id: string) =>
    router.push({ pathname: '/candidate/[id]', params: { id } });
  const goToOwned = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={summaryCard}>
        <Text style={summaryLabel}>今月の購入金額</Text>
        <Text style={summaryValue}>¥{monthSpend.toLocaleString()}</Text>
        <Text style={summarySub}>{monthCount} 点</Text>
      </View>

      {endingToday.length > 0 && (
        <Section title="今日終了する候補" tone="warning">
          {endingToday.map((cc) => (
            <ItemCard
              key={cc.item.id}
              item={cc.item}
              thumbnailRelativePath={thumbnails[cc.item.id]}
              onPress={() => goToCandidate(cc.item.id)}
            />
          ))}
        </Section>
      )}

      {endingSoon.length > 0 && (
        <Section title="24時間以内に終了">
          {endingSoon.map((cc) => (
            <ItemCard
              key={cc.item.id}
              item={cc.item}
              thumbnailRelativePath={thumbnails[cc.item.id]}
              onPress={() => goToCandidate(cc.item.id)}
            />
          ))}
        </Section>
      )}

      {overBudget.length > 0 && (
        <Section title="上限を超えている候補" tone="warning">
          {overBudget.map((cc) => (
            <ItemCard
              key={cc.item.id}
              item={cc.item}
              thumbnailRelativePath={thumbnails[cc.item.id]}
              onPress={() => goToCandidate(cc.item.id)}
            />
          ))}
        </Section>
      )}

      <Section title="最近追加した手持ち服" onSeeAll={() => router.push('/(tabs)/closet')}>
        {recentOwned.length === 0 ? (
          <EmptyState
            title="手持ち服がありません"
            actionLabel="追加する"
            onAction={() => router.push('/item/new')}
          />
        ) : (
          recentOwned.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              thumbnailRelativePath={thumbnails[it.id]}
              onPress={() => goToOwned(it.id)}
            />
          ))
        )}
      </Section>

      <Section title="ウィッシュリスト" onSeeAll={() => router.push('/(tabs)/wishlist')}>
        {recentWishlist.length === 0 ? (
          <View style={{ paddingHorizontal: space.lg, paddingVertical: space.lg }}>
            <Text style={{ color: colors.textMuted, fontSize: font.size.sm }}>
              気になっているアイテムはまだありません。
            </Text>
          </View>
        ) : (
          recentWishlist.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              thumbnailRelativePath={thumbnails[it.id]}
              onPress={() => goToCandidate(it.id)}
            />
          ))
        )}
      </Section>
    </ScrollView>
  );
}

const Section = ({
  title,
  onSeeAll,
  tone,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  tone?: 'warning';
  children: React.ReactNode;
}) => (
  <View style={section}>
    <View style={sectionHeader}>
      <Text style={[sectionTitle, tone === 'warning' ? { color: colors.warning } : null]}>
        {title}
      </Text>
      {onSeeAll && (
        <Text accessibilityRole="button" onPress={onSeeAll} style={seeAllLink}>
          すべて見る
        </Text>
      )}
    </View>
    {children}
  </View>
);

const summaryCard: ViewStyle = {
  margin: space.lg,
  padding: space.lg,
  backgroundColor: colors.surface,
  borderRadius: 12,
};

const summaryLabel = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  fontWeight: font.weight.semibold,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
} as const;

const summaryValue = {
  marginTop: space.xs,
  fontSize: font.size.xxl,
  color: colors.text,
  fontWeight: font.weight.bold,
} as const;

const summarySub = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const section: ViewStyle = {
  paddingTop: space.md,
  paddingBottom: space.md,
};

const sectionHeader: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: space.lg,
  paddingBottom: space.sm,
};

const sectionTitle = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: colors.text,
} as const;

const seeAllLink = {
  fontSize: font.size.sm,
  color: colors.textMuted,
  fontWeight: font.weight.medium,
} as const;
