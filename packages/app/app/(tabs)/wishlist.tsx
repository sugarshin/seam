import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
  type ViewStyle,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import {
  CANDIDATE_STATUSES,
  ITEM_STATUS_LABEL,
  SOURCE_TYPES,
  SOURCE_TYPE_LABEL,
  type CandidateInfo,
  type GarmentItem,
  type ItemStatus,
  type ItemPhoto,
  type SourceType,
} from '@seam/shared';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { ItemCard } from '../../src/components/ItemCard';
import { Picker, type PickerOption } from '../../src/components/Picker';
import { candidateInfoRepository, itemRepository, photoRepository } from '../../src/repositories';
import { colors, font, radii, space } from '../../src/theme';

const formatAuctionEnds = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.replace('T', ' ').slice(0, 16);
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `〆 ${mm}/${dd} ${hh}:${mi}`;
};

type WishSort = 'auctionEndsAt_asc' | 'price_asc' | 'createdAt_desc';

const SORT_OPTIONS: readonly PickerOption<WishSort>[] = [
  { value: 'auctionEndsAt_asc', label: '終了日時が近い順' },
  { value: 'price_asc', label: '価格が安い順' },
  { value: 'createdAt_desc', label: '追加日が新しい順' },
];

const STATUS_FILTER_OPTIONS: readonly PickerOption<ItemStatus | '__all__'>[] = [
  { value: '__all__', label: 'すべてのステータス' },
  ...CANDIDATE_STATUSES.map((s) => ({ value: s, label: ITEM_STATUS_LABEL[s] })),
];

const SOURCE_FILTER_OPTIONS: readonly PickerOption<SourceType | '__all__'>[] = [
  { value: '__all__', label: 'すべての出品元' },
  ...SOURCE_TYPES.map((s) => ({ value: s, label: SOURCE_TYPE_LABEL[s] })),
];

type WishItem = {
  item: GarmentItem;
  candidate: CandidateInfo | null;
  thumbnail?: string;
};

const compareItems = (a: WishItem, b: WishItem, sort: WishSort): number => {
  switch (sort) {
    case 'auctionEndsAt_asc': {
      const ax = a.candidate?.auctionEndsAt;
      const bx = b.candidate?.auctionEndsAt;
      if (!ax && !bx) return b.item.createdAt.localeCompare(a.item.createdAt);
      if (!ax) return 1;
      if (!bx) return -1;
      return ax.localeCompare(bx);
    }
    case 'price_asc': {
      const ax = a.candidate?.totalPrice ?? a.candidate?.currentPrice;
      const bx = b.candidate?.totalPrice ?? b.candidate?.currentPrice;
      if (ax === undefined && bx === undefined) {
        return b.item.createdAt.localeCompare(a.item.createdAt);
      }
      if (ax === undefined) return 1;
      if (bx === undefined) return -1;
      return ax - bx;
    }
    case 'createdAt_desc':
      return b.item.createdAt.localeCompare(a.item.createdAt);
  }
};

export default function WishlistScreen() {
  const [rows, setRows] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<WishSort>('auctionEndsAt_asc');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | '__all__'>('__all__');
  const [sourceFilter, setSourceFilter] = useState<SourceType | '__all__'>('__all__');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await itemRepository.list({ statuses: CANDIDATE_STATUSES }, 'createdAt_desc');
      const enriched: WishItem[] = await Promise.all(
        items.map(async (item) => {
          const [candidate, photos] = await Promise.all([
            candidateInfoRepository.getByItemId(item.id),
            photoRepository.listByItem(item.id),
          ]);
          const photo: ItemPhoto | undefined = photos[0];
          return {
            item,
            candidate,
            thumbnail: photo?.thumbnailRelativePath ?? photo?.relativePath,
          };
        }),
      );
      setRows(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filteredSorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (statusFilter !== '__all__' && r.item.status !== statusFilter) return false;
      if (sourceFilter !== '__all__' && r.candidate?.sourceType !== sourceFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => compareItems(a, b, sort));
  }, [rows, sort, statusFilter, sourceFilter]);

  const renderItem = ({ item }: ListRenderItemInfo<WishItem>) => {
    const c = item.candidate;
    const total = c?.totalPrice ?? c?.currentPrice;
    const ends = c?.auctionEndsAt;
    return (
      <ItemCard
        item={item.item}
        thumbnailRelativePath={item.thumbnail}
        priceLabel={total !== undefined ? `¥${total.toLocaleString()}` : undefined}
        endsLabel={ends ? formatAuctionEnds(ends) : undefined}
        onPress={() => router.push({ pathname: '/candidate/[id]', params: { id: item.item.id } })}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={header}>
        <Picker<WishSort>
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
          containerStyle={{ marginBottom: 0, flex: 1 }}
          modalTitle="並び替え"
        />
      </View>
      <View style={chipScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[...STATUS_FILTER_OPTIONS]}
          keyExtractor={(o) => o.value}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs }}
          renderItem={({ item: opt }) => (
            <Chip
              label={opt.label}
              tone={statusFilter === opt.value ? 'inverse' : 'muted'}
              selected={statusFilter === opt.value}
              onPress={() => setStatusFilter(opt.value)}
            />
          )}
        />
      </View>
      <View style={chipScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[...SOURCE_FILTER_OPTIONS]}
          keyExtractor={(o) => o.value}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs }}
          renderItem={({ item: opt }) => (
            <Chip
              label={opt.label}
              tone={sourceFilter === opt.value ? 'inverse' : 'muted'}
              selected={sourceFilter === opt.value}
              onPress={() => setSourceFilter(opt.value)}
            />
          )}
        />
      </View>

      {loading && filteredSorted.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>読み込み中…</Text>
        </View>
      ) : filteredSorted.length === 0 ? (
        <EmptyState
          title="購入候補がありません"
          message="右下の + から候補を追加してみましょう"
          actionLabel="新規追加"
          onAction={() => router.push('/candidate/new')}
        />
      ) : (
        <FlatList
          data={filteredSorted}
          keyExtractor={(it) => it.item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/candidate/new')}
        style={({ pressed }) => [fab, pressed && { opacity: 0.85 }]}
      >
        <Text style={fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const header: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: space.lg,
  paddingTop: space.md,
  paddingBottom: space.sm,
  gap: space.sm,
  backgroundColor: colors.bg,
};

const chipScrollWrapper: ViewStyle = {
  paddingVertical: space.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
};

const fab: ViewStyle = {
  position: 'absolute',
  right: space.lg,
  bottom: space.xl,
  width: 56,
  height: 56,
  borderRadius: radii.lg + 16,
  backgroundColor: colors.bgInverse,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 6,
  elevation: 6,
};

const fabText = {
  color: colors.textInverse,
  fontSize: 28,
  fontWeight: font.weight.bold,
  lineHeight: 30,
} as const;
