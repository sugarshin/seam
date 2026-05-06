import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATEGORY_LABEL,
  CONDITION_RANK_LABEL,
  FIT_RATING_LABEL,
  ITEM_STATUS_LABEL,
  MEASUREMENT_KEY_LABEL,
  type FailureLog,
  type FitAnchor,
  type GarmentItem,
  type ItemPhoto,
  type Measurement,
  type SaleInfo,
  type Tag,
  type WearLog,
} from '@seam/shared';
import { calculateCostPerWear, calculateNetCostPerWear } from '@seam/domain';
import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { ImageViewerModal } from '../../src/components/ImageViewerModal';
import { LinkText } from '../../src/components/LinkText';
import { FailureLogEntry } from '../../src/components/FailureLogEntry';
import { FailureLogModal, type FailureLogDraft } from '../../src/components/FailureLogModal';
import { SaleInfoModal, type SaleInfoDraft } from '../../src/components/SaleInfoModal';
import { WearLogEntry } from '../../src/components/WearLogEntry';
import { WearLogModal, type WearLogDraft } from '../../src/components/WearLogModal';
import { ItemForm, type ItemFormSubmit } from '../../src/forms/ItemForm';
import { absolutePathFor } from '../../src/photos/savePhoto';
import {
  deleteItemWithDetails,
  failureLogRepository,
  fitAnchorRepository,
  itemRepository,
  markAsSold,
  measurementRepository,
  photoRepository,
  saleInfoRepository,
  tagRepository,
  unmarkAsSold,
  updateItemWithDetails,
  wearLogRepository,
} from '../../src/repositories';
import { type ColorPalette, font, radii, space, useThemeColors } from '../../src/theme';
import { testIds } from '../../src/utils/testIds';

type LoadedItem = {
  item: GarmentItem;
  measurements: Measurement[];
  photos: ItemPhoto[];
  tags: Tag[];
  anchor: FitAnchor | null;
  wearLogs: WearLog[];
  wearCount: number;
  lastWornAt: string | null;
  failureLogs: FailureLog[];
  saleInfo: SaleInfo | null;
};

const formatYen = (n?: number): string => (n !== undefined ? `¥${n.toLocaleString()}` : '—');

const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
};

const formatCostPerWear = (n: number | null): string => {
  if (n === null) return '—';
  if (Math.abs(n) < 10) return `¥${n.toFixed(2)}`;
  return `¥${Math.round(n).toLocaleString()}`;
};

export default function ItemDetailScreen() {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = typeof id === 'string' ? id : undefined;
  const insets = useSafeAreaInsets();

  const [loaded, setLoaded] = useState<LoadedItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const [wearModalOpen, setWearModalOpen] = useState(false);
  const [wearSubmitting, setWearSubmitting] = useState(false);
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [failureSubmitting, setFailureSubmitting] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [sellCandidateBusy, setSellCandidateBusy] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!itemId) return;
    const item = await itemRepository.getById(itemId);
    if (!item) {
      setLoaded(null);
      return;
    }
    const [
      measurements,
      photos,
      tags,
      anchor,
      wearLogs,
      wearCount,
      lastWornAt,
      failureLogs,
      saleInfo,
    ] = await Promise.all([
      measurementRepository.listByItem(itemId),
      photoRepository.listByItem(itemId),
      tagRepository.listForItem(itemId),
      fitAnchorRepository.getByItemId(itemId),
      wearLogRepository.listByItem(itemId),
      wearLogRepository.countByItem(itemId),
      wearLogRepository.lastWornAt(itemId),
      failureLogRepository.listByItem(itemId),
      saleInfoRepository.getByItemId(itemId),
    ]);
    setLoaded({
      item,
      measurements,
      photos,
      tags,
      anchor,
      wearLogs,
      wearCount,
      lastWornAt,
      failureLogs,
      saleInfo,
    });
  }, [itemId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void tagRepository.listAll().then((tags) => setTagSuggestions(tags.map((t) => t.name)));
  }, []);

  const onSave = useCallback(
    async (input: ItemFormSubmit) => {
      if (!itemId) return;
      setSubmitting(true);
      try {
        await updateItemWithDetails({
          id: itemId,
          patch: input.item,
          measurements: input.measurements,
          tags: input.tags,
          fitAnchorName: input.fitAnchorName,
          fitAnchorNotes: input.fitAnchorNotes,
          candidateInfo: input.candidateInfo,
        });
        // photos: replace whole set (form passes the current photos including new ones already saved)
        const existing = await photoRepository.listByItem(itemId);
        const formIds = new Set(input.photos.map((p) => p.id));
        // delete photos not present
        for (const e of existing) {
          if (!formIds.has(e.id)) {
            await photoRepository.delete(e.id);
          }
        }
        // add new ones (those whose id is not yet a row)
        const existingIds = new Set(existing.map((e) => e.id));
        for (let i = 0; i < input.photos.length; i += 1) {
          const p = input.photos[i];
          if (!p) continue;
          if (existingIds.has(p.id)) continue;

          await photoRepository.create(itemId, p.relativePath, p.thumbnailRelativePath, i);
        }
        setEditing(false);
        await refresh();
      } catch (err) {
        Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [itemId, refresh],
  );

  const onDelete = useCallback(() => {
    if (!itemId) return;
    Alert.alert('削除しますか？', 'この操作は元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteItemWithDetails(itemId);
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/closet');
            } catch (err) {
              Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
            }
          })();
        },
      },
    ]);
  }, [itemId]);

  const submitWearLog = useCallback(
    async (draft: WearLogDraft) => {
      if (!itemId) return;
      setWearSubmitting(true);
      try {
        await wearLogRepository.create({
          itemId,
          wornAt: draft.wornAt,
          notes: draft.notes,
        });
        setWearModalOpen(false);
        await refresh();
      } catch (err) {
        Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
      } finally {
        setWearSubmitting(false);
      }
    },
    [itemId, refresh],
  );

  const deleteWearLog = useCallback(
    (id: string) => {
      Alert.alert('着用記録を削除', 'この記録を削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await wearLogRepository.delete(id);
                await refresh();
              } catch (err) {
                Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
              }
            })();
          },
        },
      ]);
    },
    [refresh],
  );

  const submitFailureLog = useCallback(
    async (draft: FailureLogDraft) => {
      if (!itemId) return;
      setFailureSubmitting(true);
      try {
        await failureLogRepository.create({
          itemId,
          result: draft.result,
          reason: draft.reason,
          notes: draft.notes,
        });
        setFailureModalOpen(false);
        await refresh();
      } catch (err) {
        Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
      } finally {
        setFailureSubmitting(false);
      }
    },
    [itemId, refresh],
  );

  const deleteFailureLog = useCallback(
    (id: string) => {
      Alert.alert('失敗ログを削除', 'この記録を削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await failureLogRepository.delete(id);
                await refresh();
              } catch (err) {
                Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
              }
            })();
          },
        },
      ]);
    },
    [refresh],
  );

  const toggleSellCandidate = useCallback(
    async (next: boolean) => {
      if (!itemId) return;
      setSellCandidateBusy(true);
      try {
        await itemRepository.update(itemId, { isSellCandidate: next });
        await refresh();
      } catch (err) {
        Alert.alert('更新失敗', err instanceof Error ? err.message : String(err));
      } finally {
        setSellCandidateBusy(false);
      }
    },
    [itemId, refresh],
  );

  const submitSale = useCallback(
    async (draft: SaleInfoDraft) => {
      if (!itemId || !loaded) return;
      setSaleSubmitting(true);
      try {
        if (loaded.item.status === 'sold') {
          // Update sale info but keep status.
          await saleInfoRepository.upsert({ ...draft, itemId });
        } else {
          await markAsSold(itemId, draft);
        }
        setSaleModalOpen(false);
        await refresh();
      } catch (err) {
        Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
      } finally {
        setSaleSubmitting(false);
      }
    },
    [itemId, loaded, refresh],
  );

  const onUnmarkSold = useCallback(() => {
    if (!itemId) return;
    Alert.alert('所有中に戻す', '売却記録を削除して所有中に戻しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '戻す',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await unmarkAsSold(itemId);
              await refresh();
            } catch (err) {
              Alert.alert('変更失敗', err instanceof Error ? err.message : String(err));
            }
          })();
        },
      },
    ]);
  }, [itemId, refresh]);

  const Kv = ({ k, v }: { k: string; v: string }) => (
    <View style={kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <LinkText style={styles.kvVal}>{v}</LinkText>
    </View>
  );

  // Compute the native-stack options for *every* render path, so the iOS
  // header has its title / right action configured the moment the screen is
  // pushed — not after the async refresh resolves. Registering the options
  // late was the visible cause of the back/edit button tint flicker during
  // push transitions.
  const screenOptions = editing
    ? { title: '編集', headerRight: () => null }
    : {
        title: loaded?.item.name ?? '',
        headerRight: loaded
          ? () => (
              <Text
                accessibilityRole="button"
                onPress={() => setEditing(true)}
                style={styles.editLink}
              >
                編集
              </Text>
            )
          : () => null,
      };

  if (!itemId) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.muted}>不正な ID です</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color={palette.text} />
      </View>
    );
  }

  if (editing) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <Stack.Screen options={screenOptions} />
        <ItemForm
          itemId={itemId}
          tagSuggestions={tagSuggestions}
          submitting={submitting}
          submitLabel="保存"
          onCancel={() => setEditing(false)}
          onSubmit={onSave}
          defaults={{
            values: {
              name: loaded.item.name,
              brand: loaded.item.brand,
              modelName: loaded.item.modelName,
              category: loaded.item.category,
              status: loaded.item.status,
              color: loaded.item.color,
              sizeLabel: loaded.item.sizeLabel,
              conditionRank: (loaded.item.conditionRank ?? undefined) as
                | 'S'
                | 'A'
                | 'B'
                | 'C'
                | 'D'
                | undefined,
              conditionNotes: loaded.item.conditionNotes,
              fitRating: loaded.item.fitRating,
              favoriteScore: loaded.item.favoriteScore,
              purchasePrice:
                loaded.item.purchasePrice !== undefined ? String(loaded.item.purchasePrice) : '',
              shippingFee:
                loaded.item.shippingFee !== undefined ? String(loaded.item.shippingFee) : '',
              purchaseDate: loaded.item.purchaseDate,
              purchaseSource: loaded.item.purchaseSource,
              productUrl: loaded.item.productUrl,
              notes: loaded.item.notes,
              isFitAnchor: loaded.item.isFitAnchor,
              fitAnchorName: loaded.anchor?.name,
              fitAnchorNotes: loaded.anchor?.notes,
            },
            measurements: loaded.measurements.map((m) => ({
              itemId: m.itemId,
              key: m.key,
              value: m.value,
              unit: m.unit,
            })),
            photos: loaded.photos.map((p) => ({
              id: p.id,
              relativePath: p.relativePath,
              thumbnailRelativePath: p.thumbnailRelativePath ?? p.relativePath,
            })),
            tags: loaded.tags.map((t) => t.name),
          }}
        />
      </View>
    );
  }

  const subtitle = [loaded.item.brand, loaded.item.modelName, CATEGORY_LABEL[loaded.item.category]]
    .filter((p): p is string => Boolean(p))
    .join(' · ');

  const isOwned = loaded.item.status === 'owned';
  const isSold = loaded.item.status === 'sold';
  const showAfterPurchase = isOwned || isSold;

  const totalPrice = loaded.item.totalPrice ?? loaded.item.purchasePrice;
  const cpw = calculateCostPerWear(totalPrice, loaded.wearCount);
  const netCpw = isSold
    ? calculateNetCostPerWear(totalPrice, loaded.wearCount, loaded.saleInfo?.soldPrice)
    : null;

  const recentWearLogs = loaded.wearLogs.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom }}
      >
        {loaded.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={photoStrip}>
            {loaded.photos.map((p, i) => (
              <Pressable
                key={p.id}
                accessibilityRole="imagebutton"
                accessibilityLabel="画像を拡大"
                onPress={() => setViewerIndex(i)}
              >
                <Image source={{ uri: absolutePathFor(p.relativePath) }} style={photoLarge} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={[photoStrip, { paddingHorizontal: space.lg }]}>
            <View style={styles.photoPlaceholder}>
              <Text style={styles.muted}>写真なし</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.title}>{loaded.item.name}</Text>
          {subtitle.length > 0 && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={chipRow}>
            <Chip label={ITEM_STATUS_LABEL[loaded.item.status]} tone="muted" />
            {loaded.item.isFitAnchor && <Chip label="Fit Anchor" tone="inverse" />}
            {loaded.item.isSellCandidate && <Chip label="売却候補" tone="warning" />}
          </View>
        </View>

        {loaded.measurements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>実寸</Text>
            {loaded.measurements.map((m) => (
              <View key={m.id} style={kvRow}>
                <Text style={styles.kvKey}>{MEASUREMENT_KEY_LABEL[m.key]}</Text>
                <Text style={styles.kvVal}>
                  {m.value} {m.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>詳細</Text>
          {loaded.item.color && <Kv k="色" v={loaded.item.color} />}
          {loaded.item.sizeLabel && <Kv k="サイズ表記" v={loaded.item.sizeLabel} />}
          {loaded.item.conditionRank && (
            <Kv
              k="コンディション"
              v={`${loaded.item.conditionRank} — ${CONDITION_RANK_LABEL[loaded.item.conditionRank]}`}
            />
          )}
          {loaded.item.fitRating && <Kv k="フィット" v={FIT_RATING_LABEL[loaded.item.fitRating]} />}
          {loaded.item.favoriteScore !== undefined && (
            <Kv k="お気に入り度" v={'★'.repeat(loaded.item.favoriteScore)} />
          )}
          {loaded.item.purchasePrice !== undefined && (
            <Kv k="購入価格" v={`¥${loaded.item.purchasePrice.toLocaleString()}`} />
          )}
          {loaded.item.shippingFee !== undefined && (
            <Kv k="送料" v={`¥${loaded.item.shippingFee.toLocaleString()}`} />
          )}
          {loaded.item.totalPrice !== undefined && (
            <Kv k="合計" v={`¥${loaded.item.totalPrice.toLocaleString()}`} />
          )}
          {loaded.item.purchaseDate && <Kv k="購入日" v={loaded.item.purchaseDate} />}
          {loaded.item.purchaseSource && <Kv k="購入元" v={loaded.item.purchaseSource} />}
          {loaded.item.productUrl && <Kv k="URL" v={loaded.item.productUrl} />}
          {loaded.item.conditionNotes && <Kv k="ダメージ" v={loaded.item.conditionNotes} />}
          {loaded.item.notes && <Kv k="メモ" v={loaded.item.notes} />}
        </View>

        {loaded.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>タグ</Text>
            <View style={chipRow}>
              {loaded.tags.map((t) => (
                <Chip key={t.id} label={t.name} />
              ))}
            </View>
          </View>
        )}

        {loaded.anchor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fit Anchor</Text>
            <Kv k="Anchor 名" v={loaded.anchor.name} />
            {loaded.anchor.notes && <Kv k="メモ" v={loaded.anchor.notes} />}
          </View>
        )}

        {showAfterPurchase && (
          <View style={styles.section}>
            <View style={sectionHeader}>
              <Text style={styles.sectionTitle}>着用情報</Text>
              {isOwned && (
                <Text
                  accessibilityRole="button"
                  testID={testIds.btn.addWearLog}
                  onPress={() => setWearModalOpen(true)}
                  style={styles.addLink}
                >
                  ＋着用を記録
                </Text>
              )}
            </View>
            <Kv k="着用回数" v={`${loaded.wearCount} 回`} />
            <Kv k="最終着用" v={formatDate(loaded.lastWornAt)} />
            <Kv k="Cost / Wear" v={formatCostPerWear(cpw)} />
            {isSold && <Kv k="Net / Wear" v={formatCostPerWear(netCpw)} />}
            {loaded.wearCount === 0 && isOwned && (
              <Text style={[styles.muted, { marginTop: space.sm }]}>未着用です</Text>
            )}
            {recentWearLogs.length > 0 && (
              <View style={{ marginTop: space.sm }}>
                {recentWearLogs.map((log) => (
                  <WearLogEntry
                    key={log.id}
                    log={log}
                    onDelete={isOwned ? deleteWearLog : undefined}
                  />
                ))}
                {loaded.wearLogs.length > recentWearLogs.length && (
                  <Text style={[styles.muted, { marginTop: space.xs }]}>
                    他 {loaded.wearLogs.length - recentWearLogs.length} 件
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {showAfterPurchase && (
          <View style={styles.section}>
            <View style={sectionHeader}>
              <Text style={styles.sectionTitle}>失敗ログ</Text>
              <Text
                accessibilityRole="button"
                testID={testIds.btn.addFailureLog}
                onPress={() => setFailureModalOpen(true)}
                style={styles.addLink}
              >
                ＋振り返りを追加
              </Text>
            </View>
            {loaded.failureLogs.length === 0 ? (
              <Text style={styles.muted}>まだ記録がありません。</Text>
            ) : (
              loaded.failureLogs.map((log) => (
                <FailureLogEntry key={log.id} log={log} onDelete={deleteFailureLog} />
              ))
            )}
          </View>
        )}

        {showAfterPurchase && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>売却</Text>
            {isOwned && (
              <View style={switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>売却候補にする</Text>
                  <Text style={styles.muted}>処分検討中の目印として使えます。</Text>
                </View>
                <Switch
                  testID={testIds.btn.sellCandidateToggle}
                  value={loaded.item.isSellCandidate}
                  onValueChange={(v) => void toggleSellCandidate(v)}
                  disabled={sellCandidateBusy}
                />
              </View>
            )}
            {isSold && loaded.saleInfo && (
              <View style={{ marginTop: space.sm }}>
                <Kv k="売却日" v={formatDate(loaded.saleInfo.soldAt)} />
                <Kv k="売却価格" v={formatYen(loaded.saleInfo.soldPrice)} />
                {loaded.saleInfo.soldSource && <Kv k="販売元" v={loaded.saleInfo.soldSource} />}
                {loaded.saleInfo.notes && <Kv k="メモ" v={loaded.saleInfo.notes} />}
              </View>
            )}
            <View style={{ marginTop: space.md, gap: space.sm }}>
              {isOwned && (
                <Button
                  label="Sold にする"
                  onPress={() => setSaleModalOpen(true)}
                  testID={testIds.btn.markSold}
                />
              )}
              {isSold && (
                <>
                  <Button
                    label="売却情報を編集"
                    onPress={() => setSaleModalOpen(true)}
                    variant="secondary"
                    testID={testIds.btn.editSaleInfo}
                  />
                  <Button
                    label="所有中に戻す"
                    onPress={onUnmarkSold}
                    variant="ghost"
                    testID={testIds.btn.unmarkSold}
                  />
                </>
              )}
            </View>
          </View>
        )}

        <View style={[styles.section, { gap: space.sm }]}>
          <Button label="編集" onPress={() => setEditing(true)} testID={testIds.btn.edit} />
          <Button label="削除" onPress={onDelete} variant="ghost" testID={testIds.btn.delete} />
        </View>
      </ScrollView>

      <WearLogModal
        visible={wearModalOpen}
        submitting={wearSubmitting}
        onCancel={() => setWearModalOpen(false)}
        onSubmit={(draft) => void submitWearLog(draft)}
      />

      <FailureLogModal
        visible={failureModalOpen}
        submitting={failureSubmitting}
        onCancel={() => setFailureModalOpen(false)}
        onSubmit={(draft) => void submitFailureLog(draft)}
      />

      <SaleInfoModal
        visible={saleModalOpen}
        submitting={saleSubmitting}
        initial={loaded.saleInfo}
        onCancel={() => setSaleModalOpen(false)}
        onSubmit={(draft) => void submitSale(draft)}
      />

      <ImageViewerModal
        visible={viewerIndex !== null}
        uris={loaded.photos.map((p) => absolutePathFor(p.relativePath))}
        initialIndex={viewerIndex ?? 0}
        onRequestClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const photoStrip: ViewStyle = {
  paddingVertical: space.md,
};

const photoLarge = {
  width: 240,
  height: 240,
  marginLeft: space.lg,
  borderRadius: radii.md,
} as const;

const sectionHeader: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: space.sm,
};

const chipRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.xs,
  marginTop: space.sm,
};

const kvRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  paddingVertical: space.xs,
  gap: space.md,
};

const switchRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.md,
  paddingVertical: space.sm,
};

const makeStyles = (p: ColorPalette) => ({
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: space.xl,
    backgroundColor: p.bg,
  } satisfies ViewStyle,
  muted: {
    color: p.textMuted,
    fontSize: font.size.sm,
  } as const,
  photoPlaceholder: {
    width: 240,
    height: 240,
    backgroundColor: p.surface,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  } satisfies ViewStyle,
  section: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  title: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: p.text,
  } as const,
  subtitle: {
    marginTop: space.xs,
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
  sectionTitle: {
    fontSize: font.size.xs,
    color: p.textMuted,
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: space.sm,
  } as const,
  kvKey: {
    width: 96,
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
  kvVal: {
    flex: 1,
    fontSize: font.size.sm,
    color: p.text,
  } as const,
  editLink: {
    color: p.text,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    paddingHorizontal: space.md,
  } as const,
  addLink: {
    color: p.text,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  } as const,
  switchLabel: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.medium,
  } as const,
});
