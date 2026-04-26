import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
  type ViewStyle,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import {
  CATEGORY_LABEL,
  GARMENT_CATEGORIES,
  type GarmentCategory,
  type GarmentItem,
  type ItemPhoto,
} from '@seam/shared';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { ItemCard } from '../../src/components/ItemCard';
import { Picker, type PickerOption } from '../../src/components/Picker';
import { itemRepository, photoRepository, wearLogRepository } from '../../src/repositories';
import type { ItemSort } from '../../src/repositories';
import { colors, font, radii, space } from '../../src/theme';

const SORT_OPTIONS: ReadonlyArray<PickerOption<ItemSort>> = [
  { value: 'createdAt_desc', label: '新しい順' },
  { value: 'purchaseDate_desc', label: '購入日が新しい順' },
  { value: 'purchasePrice_desc', label: '価格が高い順' },
  { value: 'favoriteScore_desc', label: 'お気に入り順' },
  { value: 'category_asc', label: 'カテゴリ順' },
  { value: 'brand_asc', label: 'ブランド順' },
];

export default function ClosetScreen() {
  const [items, setItems] = useState<GarmentItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string | undefined>>({});
  const [wearCounts, setWearCounts] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<ItemSort>('createdAt_desc');
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<GarmentCategory>>(new Set());
  const [anchorOnly, setAnchorOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await itemRepository.list(
        {
          statuses: ['owned'],
          categories: categoryFilters.size > 0 ? [...categoryFilters] : undefined,
          isFitAnchor: anchorOnly ? true : undefined,
          search: search.trim() === '' ? undefined : search.trim(),
        },
        sort,
      );
      setItems(list);
      const map: Record<string, string | undefined> = {};
      await Promise.all(
        list.map(async (it) => {
          const photos: ItemPhoto[] = await photoRepository.listByItem(it.id);
          map[it.id] = photos[0]?.thumbnailRelativePath ?? photos[0]?.relativePath;
        }),
      );
      setThumbnails(map);
      const counts = await wearLogRepository.countsByItems(list.map((it) => it.id));
      setWearCounts(counts);
    } finally {
      setLoading(false);
    }
  }, [sort, search, categoryFilters, anchorOnly]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCategory = (c: GarmentCategory): void => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const renderItem = ({ item }: ListRenderItemInfo<GarmentItem>) => (
    <ItemCard
      item={item}
      thumbnailRelativePath={thumbnails[item.id]}
      wearCount={wearCounts[item.id]}
      onPress={() =>
        router.push({ pathname: '/item/[id]', params: { id: item.id } })
      }
    />
  );

  const filterChips = useMemo(() => GARMENT_CATEGORIES, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={header}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="検索"
          placeholderTextColor={colors.textMuted}
          style={searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <Picker<ItemSort>
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
          data={[...filterChips]}
          keyExtractor={(c) => c}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs }}
          ListHeaderComponent={
            <View style={{ marginRight: space.xs }}>
              <Chip
                label="Anchor"
                tone={anchorOnly ? 'inverse' : 'muted'}
                onPress={() => setAnchorOnly((v) => !v)}
                selected={anchorOnly}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Chip
              label={CATEGORY_LABEL[item]}
              tone={categoryFilters.has(item) ? 'inverse' : 'muted'}
              selected={categoryFilters.has(item)}
              onPress={() => toggleCategory(item)}
            />
          )}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>読み込み中…</Text>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title="まだ手持ち服がありません"
          message="右下の + から登録してみましょう"
          actionLabel="新規登録"
          onAction={() => router.push('/item/new')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/item/new')}
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

const searchInput = {
  flex: 1,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  paddingHorizontal: space.md,
  paddingVertical: space.sm + 2,
  fontSize: font.size.md,
  color: colors.text,
  backgroundColor: colors.bg,
} as const;

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
  borderRadius: 28,
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
