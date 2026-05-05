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
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import {
  CATEGORY_LABEL,
  GARMENT_CATEGORIES,
  type GarmentCategory,
  type GarmentItem,
  type ItemPhoto,
  type SaleInfo,
} from '@seam/shared';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { ItemCard } from '../../src/components/ItemCard';
import { Picker, type PickerOption } from '../../src/components/Picker';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { itemRepository, photoRepository, wearLogRepository } from '../../src/repositories';
import type { ItemSort, SoldItem } from '../../src/repositories';
import { type ColorPalette, font, radii, space, useThemeColors } from '../../src/theme';
import { testIds } from '../../src/utils/testIds';

type ClosetMode = 'owned' | 'sold';

const OWNED_SORT_OPTIONS: readonly PickerOption<ItemSort>[] = [
  { value: 'createdAt_desc', label: '新しい順' },
  { value: 'purchaseDate_desc', label: '購入日が新しい順' },
  { value: 'purchasePrice_desc', label: '価格が高い順' },
  { value: 'favoriteScore_desc', label: 'お気に入り順' },
  { value: 'category_asc', label: 'カテゴリ順' },
  { value: 'brand_asc', label: 'ブランド順' },
];

const SOLD_SORT_OPTIONS: readonly PickerOption<ItemSort>[] = [
  { value: 'soldAt_desc', label: '売却日が新しい順' },
  { value: 'soldAt_asc', label: '売却日が古い順' },
  { value: 'recoveryRate_desc', label: '回収率が高い順' },
  { value: 'netCpw_asc', label: 'Net CPW が良い順' },
  { value: 'purchaseDate_desc', label: '購入日が新しい順' },
  { value: 'category_asc', label: 'カテゴリ順' },
];

type RecoveryRangeKey = 'all' | 'high' | 'mid' | 'low' | 'veryLow';

const RECOVERY_RANGE_OPTIONS: readonly PickerOption<RecoveryRangeKey>[] = [
  { value: 'all', label: 'すべて' },
  { value: 'high', label: '80% 以上' },
  { value: 'mid', label: '50–80%' },
  { value: 'low', label: '30–50%' },
  { value: 'veryLow', label: '30% 未満' },
];

const RECOVERY_RANGE_LABEL: Record<RecoveryRangeKey, string> = {
  all: '回収率',
  high: '回収 80%+',
  mid: '回収 50–80%',
  low: '回収 30–50%',
  veryLow: '回収 <30%',
};

const recoveryRangeBounds = (key: RecoveryRangeKey): { min?: number; max?: number } => {
  switch (key) {
    case 'all':
      return {};
    case 'high':
      return { min: 0.8 };
    case 'mid':
      return { min: 0.5, max: 0.8 };
    case 'low':
      return { min: 0.3, max: 0.5 };
    case 'veryLow':
      return { max: 0.3 };
  }
};

const yearBounds = (year: number): { from: string; to: string } => ({
  from: `${year}-01-01`,
  to: `${year + 1}-01-01`,
});

export default function ClosetScreen() {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: ClosetMode = params.mode === 'sold' ? 'sold' : 'owned';

  const [mode, setMode] = useState<ClosetMode>(initialMode);
  const [ownedSort, setOwnedSort] = useState<ItemSort>('createdAt_desc');
  const [soldSort, setSoldSort] = useState<ItemSort>('soldAt_desc');
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<GarmentCategory>>(new Set());
  const [anchorOnly, setAnchorOnly] = useState(false);
  const [soldYear, setSoldYear] = useState<number | undefined>(undefined);
  const [recoveryRange, setRecoveryRange] = useState<RecoveryRangeKey>('all');

  const [ownedItems, setOwnedItems] = useState<GarmentItem[]>([]);
  const [soldItems, setSoldItems] = useState<SoldItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string | undefined>>({});
  const [wearCounts, setWearCounts] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<{ owned: number; sold: number }>({ owned: 0, sold: 0 });
  const [yearOptions, setYearOptions] = useState<readonly PickerOption<string>[]>([
    { value: '', label: 'すべて' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialMode !== mode) setMode(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trimmedSearch = search.trim() === '' ? undefined : search.trim();
      const categories = categoryFilters.size > 0 ? [...categoryFilters] : undefined;

      if (mode === 'owned') {
        const list = await itemRepository.list(
          {
            statuses: ['owned'],
            categories,
            isFitAnchor: anchorOnly ? true : undefined,
            search: trimmedSearch,
          },
          ownedSort,
        );
        setOwnedItems(list);
        const map: Record<string, string | undefined> = {};
        await Promise.all(
          list.map(async (it) => {
            const photos: ItemPhoto[] = await photoRepository.listByItem(it.id);
            map[it.id] = photos[0]?.thumbnailRelativePath ?? photos[0]?.relativePath;
          }),
        );
        setThumbnails(map);
        const c = await wearLogRepository.countsByItems(list.map((it) => it.id));
        setWearCounts(c);
      } else {
        const range = recoveryRangeBounds(recoveryRange);
        const yearWindow = soldYear !== undefined ? yearBounds(soldYear) : undefined;
        const list = await itemRepository.listSold(
          {
            categories,
            search: trimmedSearch,
            soldAtFrom: yearWindow?.from,
            soldAtTo: yearWindow?.to,
            recoveryRateMin: range.min,
            recoveryRateMax: range.max,
          },
          soldSort,
        );
        setSoldItems(list);
        const map: Record<string, string | undefined> = {};
        await Promise.all(
          list.map(async (it) => {
            const photos: ItemPhoto[] = await photoRepository.listByItem(it.id);
            map[it.id] = photos[0]?.thumbnailRelativePath ?? photos[0]?.relativePath;
          }),
        );
        setThumbnails(map);
      }

      const totals = await itemRepository.countByStatus();
      setCounts({ owned: totals.owned ?? 0, sold: totals.sold ?? 0 });
    } finally {
      setLoading(false);
    }
  }, [mode, ownedSort, soldSort, search, categoryFilters, anchorOnly, soldYear, recoveryRange]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Build the sold-year picker options from existing sale dates whenever we
  // visit Sold mode. This stays scoped to actual data the user has, so empty
  // years don't pollute the picker.
  useEffect(() => {
    if (mode !== 'sold') return;
    let cancelled = false;
    void (async () => {
      const all = await itemRepository.listSold({}, 'soldAt_desc');
      if (cancelled) return;
      const years = new Set<number>();
      for (const it of all) {
        const at = it.saleInfo.soldAt;
        if (!at) continue;
        const y = Number(at.slice(0, 4));
        if (Number.isFinite(y)) years.add(y);
      }
      const sorted = [...years].sort((a, b) => b - a);
      setYearOptions([
        { value: '', label: 'すべて' },
        ...sorted.map((y) => ({ value: String(y), label: `${y} 年` })),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const switchMode = (next: ClosetMode) => {
    if (next === mode) return;
    if (next === 'sold' && anchorOnly) {
      // Anchor is an owned-only concept; clear it on the way to Sold.
      setAnchorOnly(false);
    }
    setMode(next);
  };

  const toggleCategory = (c: GarmentCategory): void => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const renderOwned = ({ item }: ListRenderItemInfo<GarmentItem>) => (
    <ItemCard
      item={item}
      thumbnailRelativePath={thumbnails[item.id]}
      wearCount={wearCounts[item.id]}
      testID={testIds.cardItem(item.id)}
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
    />
  );

  const renderSold = ({ item }: ListRenderItemInfo<SoldItem>) => {
    const sale: SaleInfo = item.saleInfo;
    return (
      <ItemCard
        item={item}
        thumbnailRelativePath={thumbnails[item.id]}
        saleInfo={sale}
        recoveryRate={item.recoveryRate}
        testID={testIds.cardItem(item.id)}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      />
    );
  };

  const filterChips = useMemo(() => GARMENT_CATEGORIES, []);
  const sortOptions = mode === 'owned' ? OWNED_SORT_OPTIONS : SOLD_SORT_OPTIONS;
  const sortValue = mode === 'owned' ? ownedSort : soldSort;
  const onSortChange = mode === 'owned' ? setOwnedSort : setSoldSort;

  const items: GarmentItem[] | SoldItem[] = mode === 'owned' ? ownedItems : soldItems;
  const isEmpty = items.length === 0;
  const recoveryLabel =
    recoveryRange === 'all' ? RECOVERY_RANGE_LABEL.all : RECOVERY_RANGE_LABEL[recoveryRange];
  const yearLabel = soldYear !== undefined ? `${soldYear} 年` : '売却年';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={segmentWrap}>
        <SegmentedControl<ClosetMode>
          value={mode}
          options={[
            { value: 'owned', label: '所有中', badge: counts.owned },
            { value: 'sold', label: '売却済み', badge: counts.sold },
          ]}
          onChange={switchMode}
          testID={testIds.seg.closetMode}
        />
      </View>

      <View style={styles.header}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="検索"
          placeholderTextColor={palette.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
          testID={testIds.field.closetSearch}
        />
        <Picker<ItemSort>
          value={sortValue}
          options={sortOptions}
          onChange={onSortChange}
          containerStyle={{ marginBottom: 0, flex: 1 }}
          modalTitle="並び替え"
          testID={testIds.picker.closetSort}
        />
      </View>

      {mode === 'sold' && (
        <View style={styles.soldFilterRow}>
          <Picker<string>
            value={soldYear !== undefined ? String(soldYear) : ''}
            options={yearOptions}
            onChange={(v) => setSoldYear(v === '' ? undefined : Number(v))}
            containerStyle={{ marginBottom: 0, flex: 1 }}
            placeholder={yearLabel}
            modalTitle="売却年"
            testID={testIds.picker.closetSoldYear}
          />
          <Picker<RecoveryRangeKey>
            value={recoveryRange}
            options={RECOVERY_RANGE_OPTIONS}
            onChange={setRecoveryRange}
            containerStyle={{ marginBottom: 0, flex: 1 }}
            placeholder={recoveryLabel}
            modalTitle="回収率"
            testID={testIds.picker.closetRecovery}
          />
        </View>
      )}

      <View style={styles.chipScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[...filterChips]}
          keyExtractor={(c) => c}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs }}
          ListHeaderComponent={
            mode === 'owned' ? (
              <View style={{ marginRight: space.xs }}>
                <Chip
                  label="Anchor"
                  tone={anchorOnly ? 'inverse' : 'muted'}
                  onPress={() => setAnchorOnly((v) => !v)}
                  selected={anchorOnly}
                  testID={testIds.chip.anchor}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Chip
              label={CATEGORY_LABEL[item]}
              tone={categoryFilters.has(item) ? 'inverse' : 'muted'}
              selected={categoryFilters.has(item)}
              onPress={() => toggleCategory(item)}
              testID={testIds.chipCategory(item)}
            />
          )}
        />
      </View>

      {loading && isEmpty ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.textMuted }}>読み込み中…</Text>
        </View>
      ) : isEmpty ? (
        mode === 'owned' ? (
          <EmptyState
            title="まだ手持ち服がありません"
            message="右下の + から登録してみましょう"
            actionLabel="新規登録"
            onAction={() => router.push('/item/new')}
            actionTestID={testIds.btn.closetEmptyAdd}
          />
        ) : (
          <EmptyState
            title="売却済みのアイテムはまだありません"
            message="所有アイテムを売却すると、ここに記録されます"
          />
        )
      ) : mode === 'owned' ? (
        <FlatList
          data={ownedItems}
          keyExtractor={(it) => it.id}
          renderItem={renderOwned}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      ) : (
        <FlatList
          data={soldItems}
          keyExtractor={(it) => it.id}
          renderItem={renderSold}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}

      {mode === 'owned' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="アイテムを追加"
          testID={testIds.fab.addItem}
          onPress={() => router.push('/item/new')}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      )}
    </View>
  );
}

const segmentWrap: ViewStyle = {
  paddingHorizontal: space.lg,
  paddingTop: space.md,
};

const makeStyles = (p: ColorPalette) => ({
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
    backgroundColor: p.bg,
  } satisfies ViewStyle,
  soldFilterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
    backgroundColor: p.bg,
  } satisfies ViewStyle,
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: font.size.md,
    color: p.text,
    backgroundColor: p.bg,
  } as const,
  chipScrollWrapper: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  fab: {
    position: 'absolute' as const,
    right: space.lg,
    bottom: space.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: p.bgInverse,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  } satisfies ViewStyle,
  fabText: {
    color: p.textInverse,
    fontSize: 28,
    fontWeight: font.weight.bold,
    lineHeight: 30,
  } as const,
});
