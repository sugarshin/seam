import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATEGORY_LABEL,
  CONDITION_RANK_LABEL,
  ITEM_STATUS_LABEL,
  MEASUREMENT_KEY_LABEL,
  SOURCE_TYPE_LABEL,
  type BrandChecklistState,
  type BrandGuide,
  type CandidateEvaluation,
  type CandidateInfo,
  type DecisionLog,
  type FitAnchor,
  type GarmentItem,
  type ItemPhoto,
  type Measurement,
  type MeasurementInput,
  type PriceSnapshot,
  type Reminder,
  type ScoreDecision,
  type Tag,
} from '@seam/shared';
import type { ExtractedMeasurement } from '@seam/domain';
import { BrandChecklist } from '../../src/components/BrandChecklist';
import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { LinkText } from '../../src/components/LinkText';
import { DecisionReasonModal } from '../../src/components/DecisionReasonModal';
import { MeasurementExtractionReviewModal } from '../../src/components/MeasurementExtractionReviewModal';
import {
  ReminderSettingsModal,
  type ReminderSettingsResult,
} from '../../src/components/ReminderSettingsModal';
import { ScoreBadge } from '../../src/components/ScoreBadge';
import { ScoreBreakdown, breakdownFromEvaluation } from '../../src/components/ScoreBreakdown';
import {
  cancelReminders,
  leadTimeLabel,
  requestNotificationPermissions,
  scheduleAuctionReminders,
  type ReminderLeadTime,
} from '../../src/notifications';
import { ItemForm, type ItemFormSubmit } from '../../src/forms/ItemForm';
import { absolutePathFor } from '../../src/photos/savePhoto';
import {
  brandChecklistStateRepository,
  brandGuideRepository,
  candidateInfoRepository,
  decisionLogRepository,
  deleteItemWithDetails,
  evaluationRepository,
  fitAnchorRepository,
  itemRepository,
  measurementRepository,
  photoRepository,
  priceSnapshotRepository,
  reminderRepository,
  tagRepository,
  updateItemWithDetails,
} from '../../src/repositories';
import {
  computeCandidateScore,
  recordDecision,
  type ComputeCandidateScoreResult,
} from '../../src/scoring';
import { colors, font, radii, space } from '../../src/theme';

type LoadedCandidate = {
  item: GarmentItem;
  candidate: CandidateInfo | null;
  measurements: Measurement[];
  photos: ItemPhoto[];
  tags: Tag[];
  anchor: FitAnchor | null;
  snapshots: PriceSnapshot[];
  latestEvaluation: CandidateEvaluation | null;
  decisionLogs: DecisionLog[];
  brandGuides: BrandGuide[];
  brandChecklistStates: Record<string, BrandChecklistState[]>;
  reminders: Reminder[];
};

const LEAD_TIME_MS_LOOKUP: Record<ReminderLeadTime, number> = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

const ALL_LEAD_TIMES_TUPLE: readonly ReminderLeadTime[] = ['10m', '30m', '1h', '3h', '1d'];

/**
 * Recover the lead-time labels currently configured by inspecting how many
 * milliseconds before `auctionEndsAt` each reminder is set to fire. Reminders
 * that don't match any known lead-time bucket are ignored — the UI normalises
 * to the predefined bucket set.
 */
const deriveLeadTimes = (
  reminders: readonly Reminder[],
  auctionEndsAt: string | undefined,
): readonly ReminderLeadTime[] => {
  if (!auctionEndsAt) return [];
  const endMs = new Date(auctionEndsAt).getTime();
  if (Number.isNaN(endMs)) return [];
  const out: ReminderLeadTime[] = [];
  for (const lt of ALL_LEAD_TIMES_TUPLE) {
    const target = endMs - LEAD_TIME_MS_LOOKUP[lt];
    const match = reminders.find((r) => {
      const rMs = new Date(r.remindAt).getTime();
      // Allow a 30 second tolerance to account for round-trips through the DB.
      return Math.abs(rMs - target) < 30 * 1000;
    });
    if (match) out.push(lt);
  }
  return out;
};

const DECISION_LABEL: Record<DecisionLog['decision'], string> = {
  buy: 'Buy',
  watch: 'Watch',
  skip: 'Skip',
  lost_auction: 'Lost Auction',
};

const DECISION_TONE: Record<DecisionLog['decision'], string> = {
  buy: colors.same,
  watch: colors.different,
  skip: colors.warning,
  lost_auction: colors.textMuted,
};

const formatYen = (n?: number): string => (n !== undefined ? `¥${n.toLocaleString()}` : '—');

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

export default function CandidateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = typeof id === 'string' ? id : undefined;
  const insets = useSafeAreaInsets();

  const [loaded, setLoaded] = useState<LoadedCandidate | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [decisionDraft, setDecisionDraft] = useState<ScoreDecision | null>(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [pendingScore, setPendingScore] = useState<ComputeCandidateScoreResult | null>(null);
  const [extractionVisible, setExtractionVisible] = useState(false);
  const [extractionSubmitting, setExtractionSubmitting] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

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
      candidate,
      snapshots,
      latestEvaluation,
      decisionLogs,
      reminders,
    ] = await Promise.all([
      measurementRepository.listByItem(itemId),
      photoRepository.listByItem(itemId),
      tagRepository.listForItem(itemId),
      fitAnchorRepository.getByItemId(itemId),
      candidateInfoRepository.getByItemId(itemId),
      priceSnapshotRepository.listByItem(itemId),
      evaluationRepository.latestByItem(itemId),
      decisionLogRepository.listByItem(itemId),
      reminderRepository.listByItem(itemId),
    ]);
    const brandGuides = item.brand ? await brandGuideRepository.listByBrand(item.brand) : [];
    const brandChecklistStates: Record<string, BrandChecklistState[]> = {};
    await Promise.all(
      brandGuides.map(async (g) => {
        brandChecklistStates[g.id] = await brandChecklistStateRepository.listForItemAndGuide(
          itemId,
          g.id,
        );
      }),
    );
    setLoaded({
      item,
      measurements,
      photos,
      tags,
      anchor,
      candidate,
      snapshots,
      latestEvaluation,
      decisionLogs,
      brandGuides,
      brandChecklistStates,
      reminders,
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

        // Reconcile photos (same logic as item/[id])
        const existing = await photoRepository.listByItem(itemId);
        const formIds = new Set(input.photos.map((p) => p.id));
        for (const e of existing) {
          if (!formIds.has(e.id)) {
            await photoRepository.delete(e.id);
          }
        }
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
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteItemWithDetails(itemId);
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/wishlist');
            } catch (err) {
              Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
            }
          })();
        },
      },
    ]);
  }, [itemId]);

  const recordCurrentPrice = useCallback(async () => {
    if (!itemId || !loaded) return;
    const c = loaded.candidate;
    if (!c || c.currentPrice === undefined) {
      Alert.alert('現在価格が未設定です', '編集から「現在価格」を入力してください。');
      return;
    }
    try {
      await priceSnapshotRepository.create(itemId, c.currentPrice, c.shippingFee, c.totalPrice);
      await refresh();
    } catch (err) {
      Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
    }
  }, [itemId, loaded, refresh]);

  const openDecision = useCallback(
    (decision: ScoreDecision) => {
      if (!itemId) return;
      // Compute a fresh score so we can persist a CandidateEvaluation snapshot
      // alongside the DecisionLog. Failure here should not block the dialog.
      void (async () => {
        try {
          const computed = await computeCandidateScore(itemId);
          setPendingScore(computed);
        } catch {
          setPendingScore(null);
        } finally {
          setDecisionDraft(decision);
        }
      })();
    },
    [itemId],
  );

  const onDecisionSubmit = useCallback(
    (reason: string) => {
      if (!itemId || !decisionDraft) return;
      setDecisionSubmitting(true);
      void (async () => {
        try {
          await recordDecision({
            itemId,
            decision: decisionDraft,
            reason,
            score: pendingScore ?? undefined,
            priceAtDecision: loaded?.candidate?.totalPrice ?? loaded?.candidate?.currentPrice,
          });
          setDecisionDraft(null);
          setPendingScore(null);
          if (decisionDraft === 'buy') {
            router.replace({ pathname: '/item/[id]', params: { id: itemId } });
          } else {
            await refresh();
          }
        } catch (err) {
          Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
        } finally {
          setDecisionSubmitting(false);
        }
      })();
    },
    [decisionDraft, itemId, loaded?.candidate, pendingScore, refresh],
  );

  const onAdoptExtractedMeasurements = useCallback(
    (adopted: ExtractedMeasurement[]) => {
      if (!itemId || !loaded) return;
      setExtractionSubmitting(true);
      void (async () => {
        try {
          // Merge: keep any existing keys that the user did NOT extract, and
          // overwrite the keys present in `adopted` with the new values.
          const adoptedKeys = new Set(adopted.map((m) => m.key));
          const kept: MeasurementInput[] = loaded.measurements
            .filter((m) => !adoptedKeys.has(m.key))
            .map(({ itemId: iid, key, value, unit }) => ({ itemId: iid, key, value, unit }));
          const next: MeasurementInput[] = [...kept, ...adopted.map((m) => ({ ...m, itemId }))];
          await measurementRepository.upsertForItem(itemId, next);
          setExtractionVisible(false);
          await refresh();
        } catch (err) {
          Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
        } finally {
          setExtractionSubmitting(false);
        }
      })();
    },
    [itemId, loaded, refresh],
  );

  const onToggleChecklist = useCallback(
    (brandGuideId: string, checklistItemKey: string, isChecked: boolean): void => {
      if (!itemId) return;
      void (async () => {
        try {
          await brandChecklistStateRepository.toggleItem({
            itemId,
            brandGuideId,
            checklistItemKey,
            isChecked,
          });
          await refresh();
        } catch (err) {
          Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
        }
      })();
    },
    [itemId, refresh],
  );

  const onReminderSubmit = useCallback(
    (result: ReminderSettingsResult) => {
      if (!itemId || !loaded) return;
      const auctionEndsAt = loaded.candidate?.auctionEndsAt;
      if (!auctionEndsAt) {
        Alert.alert('終了日時が未設定です', '編集から「終了日時」を入力してください。');
        return;
      }
      setReminderSubmitting(true);
      void (async () => {
        try {
          // First, cancel + delete any existing reminders so we never leak a
          // scheduled OS notification when the user changes the configuration.
          const existing = await reminderRepository.listByItem(itemId);
          const existingIds = existing
            .map((r) => r.notificationId)
            .filter((id): id is string => Boolean(id));
          if (existingIds.length > 0) {
            try {
              await cancelReminders(existingIds);
            } catch {
              // Best-effort: continue even if some IDs are stale.
            }
          }
          await reminderRepository.deleteByItem(itemId);

          if (!result.enabled || result.leadTimes.length === 0) {
            setReminderModalVisible(false);
            await refresh();
            return;
          }

          const granted = await requestNotificationPermissions();
          if (!granted) {
            Alert.alert(
              '通知が許可されていません',
              '設定アプリから Seam の通知を有効にしてください。',
            );
            await refresh();
            return;
          }

          const scheduled = await scheduleAuctionReminders({
            itemId,
            itemName: loaded.item.name,
            auctionEndsAt,
            leadTimes: result.leadTimes,
          });

          for (const r of scheduled) {
            await reminderRepository.create({
              itemId,
              remindAt: r.remindAt,
              notificationId: r.notificationId,
              isEnabled: true,
            });
          }

          if (scheduled.length === 0 && result.leadTimes.length > 0) {
            Alert.alert('通知をスケジュールできませんでした', '選択した時刻はすでに過ぎています。');
          }

          setReminderModalVisible(false);
          await refresh();
        } catch (err) {
          Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
        } finally {
          setReminderSubmitting(false);
        }
      })();
    },
    [itemId, loaded, refresh],
  );

  const markLostAuction = useCallback(() => {
    if (!itemId) return;
    Alert.alert('落札失敗にする', 'ステータスを「落札失敗」に変更します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '変更',
        onPress: () => {
          void (async () => {
            try {
              await itemRepository.setStatus(itemId, 'lost_auction');
              await refresh();
            } catch (err) {
              Alert.alert('変更失敗', err instanceof Error ? err.message : String(err));
            }
          })();
        },
      },
    ]);
  }, [itemId, refresh]);

  if (!itemId) {
    return (
      <View style={center}>
        <Text style={muted}>不正な ID です</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (editing) {
    const c = loaded.candidate;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '編集', headerShown: true, headerRight: () => null }} />
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
              sourceType: c?.sourceType,
              candidateCurrentPrice: c?.currentPrice !== undefined ? String(c.currentPrice) : '',
              candidateShippingFee: c?.shippingFee !== undefined ? String(c.shippingFee) : '',
              auctionEndsAt: c?.auctionEndsAt,
              easyBuyPrice: c?.easyBuyPrice !== undefined ? String(c.easyBuyPrice) : '',
              acceptablePrice: c?.acceptablePrice !== undefined ? String(c.acceptablePrice) : '',
              maxBidPrice: c?.maxBidPrice !== undefined ? String(c.maxBidPrice) : '',
              sellerName: c?.sellerName,
              listingDescription: c?.listingDescription,
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

  const c = loaded.candidate;
  const overBudget =
    c?.totalPrice !== undefined && c.maxBidPrice !== undefined && c.totalPrice > c.maxBidPrice;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: loaded.item.name,
          headerShown: true,
          headerRight: () => (
            <Text accessibilityRole="button" onPress={() => setEditing(true)} style={editLink}>
              編集
            </Text>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom }}
      >
        {loaded.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={photoStrip}>
            {loaded.photos.map((p) => (
              <Image
                key={p.id}
                source={{ uri: absolutePathFor(p.relativePath) }}
                style={photoLarge}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[photoStrip, { paddingHorizontal: space.lg }]}>
            <View style={photoPlaceholder}>
              <Text style={muted}>写真なし</Text>
            </View>
          </View>
        )}

        <View style={section}>
          <Text style={titleStyle}>{loaded.item.name}</Text>
          {subtitle.length > 0 && <Text style={subtitleStyle}>{subtitle}</Text>}
          <View style={chipRow}>
            <Chip label={ITEM_STATUS_LABEL[loaded.item.status]} tone="muted" />
            {c?.sourceType && <Chip label={SOURCE_TYPE_LABEL[c.sourceType]} />}
            {loaded.item.isFitAnchor && <Chip label="Fit Anchor" tone="inverse" />}
            {loaded.item.conditionRank && (
              <Chip
                label={`${loaded.item.conditionRank} · ${CONDITION_RANK_LABEL[loaded.item.conditionRank]}`}
                tone="muted"
              />
            )}
          </View>
        </View>

        {loaded.latestEvaluation && (
          <View style={section}>
            <Text style={sectionTitle}>最新スコア</Text>
            <View style={{ gap: space.md }}>
              <ScoreBadge
                totalScore={loaded.latestEvaluation.totalScore}
                decision={loaded.latestEvaluation.decision}
              />
              <ScoreBreakdown breakdown={breakdownFromEvaluation(loaded.latestEvaluation)} />
              <Text style={muted}>記録日時: {formatDate(loaded.latestEvaluation.createdAt)}</Text>
            </View>
          </View>
        )}

        {c && (
          <View style={section}>
            <Text style={sectionTitle}>販売情報</Text>
            <Kv k="現在価格" v={formatYen(c.currentPrice)} />
            <Kv k="送料" v={formatYen(c.shippingFee)} />
            <Kv k="合計" v={formatYen(c.totalPrice)} emphasize={overBudget} />
            <Kv k="即決" v={formatYen(c.easyBuyPrice)} />
            <Kv k="許容" v={formatYen(c.acceptablePrice)} />
            <Kv k="上限" v={formatYen(c.maxBidPrice)} emphasize={overBudget} />
            <Kv k="終了日時" v={formatDate(c.auctionEndsAt)} />
            {c.sellerName && <Kv k="出品者" v={c.sellerName} />}
            {loaded.item.productUrl && <Kv k="URL" v={loaded.item.productUrl} />}
            {c.listingDescription && <Kv k="説明" v={c.listingDescription} />}
            {overBudget && <Text style={warning}>合計が上限価格を超えています</Text>}
          </View>
        )}

        <View style={section}>
          <View style={snapshotsHeader}>
            <Text style={sectionTitle}>価格スナップショット</Text>
            <Text
              accessibilityRole="button"
              onPress={() => void recordCurrentPrice()}
              style={addLink}
            >
              ＋現在価格を記録
            </Text>
          </View>
          {loaded.snapshots.length === 0 ? (
            <Text style={muted}>まだ記録がありません。</Text>
          ) : (
            loaded.snapshots.map((s) => (
              <View key={s.id} style={kvRow}>
                <Text style={kvKey}>{formatDate(s.recordedAt)}</Text>
                <Text style={kvVal}>{formatYen(s.totalPrice ?? s.price)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={section}>
          <View style={snapshotsHeader}>
            <Text style={sectionTitle}>実寸</Text>
            {c?.listingDescription && (
              <Text
                accessibilityRole="button"
                onPress={() => setExtractionVisible(true)}
                style={addLink}
              >
                ＋説明文から抽出
              </Text>
            )}
          </View>
          {loaded.measurements.length === 0 ? (
            <Text style={muted}>まだ実寸が登録されていません。</Text>
          ) : (
            loaded.measurements.map((m) => (
              <View key={m.id} style={kvRow}>
                <Text style={kvKey}>{MEASUREMENT_KEY_LABEL[m.key]}</Text>
                <Text style={kvVal}>
                  {m.value} {m.unit}
                </Text>
              </View>
            ))
          )}
        </View>

        {loaded.brandGuides.length > 0 && (
          <View style={section}>
            <Text style={sectionTitle}>ブランドガイド</Text>
            {loaded.brandGuides.map((g) => (
              <View key={g.id} style={brandGuideCard}>
                <Text style={brandGuideTitle}>{g.title}</Text>
                {g.notes.length > 0 && <Text style={brandGuideNotes}>{g.notes}</Text>}
                <View style={{ marginTop: space.sm }}>
                  <BrandChecklist
                    guide={g}
                    itemId={itemId}
                    states={loaded.brandChecklistStates[g.id] ?? []}
                    onToggle={(key, checked) => onToggleChecklist(g.id, key, checked)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {(loaded.item.color ||
          loaded.item.sizeLabel ||
          loaded.item.conditionNotes ||
          loaded.item.notes) && (
          <View style={section}>
            <Text style={sectionTitle}>詳細</Text>
            {loaded.item.color && <Kv k="色" v={loaded.item.color} />}
            {loaded.item.sizeLabel && <Kv k="サイズ表記" v={loaded.item.sizeLabel} />}
            {loaded.item.conditionNotes && <Kv k="ダメージ" v={loaded.item.conditionNotes} />}
            {loaded.item.notes && <Kv k="メモ" v={loaded.item.notes} />}
          </View>
        )}

        {loaded.tags.length > 0 && (
          <View style={section}>
            <Text style={sectionTitle}>タグ</Text>
            <View style={chipRow}>
              {loaded.tags.map((t) => (
                <Chip key={t.id} label={t.name} />
              ))}
            </View>
          </View>
        )}

        {loaded.anchor && (
          <View style={section}>
            <Text style={sectionTitle}>Fit Anchor</Text>
            <Kv k="Anchor 名" v={loaded.anchor.name} />
            {loaded.anchor.notes && <Kv k="メモ" v={loaded.anchor.notes} />}
          </View>
        )}

        <View style={section}>
          <Text style={sectionTitle}>終了通知</Text>
          {(() => {
            const auctionEndsAt = loaded.candidate?.auctionEndsAt;
            const activeReminders = loaded.reminders.filter((r) => r.isEnabled);
            const lts = deriveLeadTimes(activeReminders, auctionEndsAt);
            if (!auctionEndsAt) {
              return (
                <Text style={muted}>
                  終了日時を「販売情報」に登録すると、リマインダーを設定できます。
                </Text>
              );
            }
            return (
              <View style={{ gap: space.sm }}>
                {lts.length === 0 ? (
                  <Text style={muted}>未設定</Text>
                ) : (
                  <View style={chipRow}>
                    {lts.map((lt) => (
                      <Chip key={lt} label={leadTimeLabel(lt)} tone="muted" />
                    ))}
                  </View>
                )}
                <Button
                  label={lts.length === 0 ? '通知を設定する' : '通知設定を変更'}
                  onPress={() => setReminderModalVisible(true)}
                  variant="secondary"
                />
              </View>
            );
          })()}
        </View>

        <View style={section}>
          <Text style={sectionTitle}>判定履歴</Text>
          {loaded.decisionLogs.length === 0 ? (
            <Text style={muted}>まだ判定が記録されていません。</Text>
          ) : (
            loaded.decisionLogs.map((d) => (
              <View key={d.id} style={decisionLogRow}>
                <View style={[decisionBadge, { borderColor: DECISION_TONE[d.decision] }]}>
                  <Text style={[decisionBadgeText, { color: DECISION_TONE[d.decision] }]}>
                    {DECISION_LABEL[d.decision]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={decisionDateText}>{formatDate(d.createdAt)}</Text>
                  <Text style={decisionReasonText}>{d.reason}</Text>
                  {d.priceAtDecision !== undefined && (
                    <Text style={muted}>判定時の価格: {formatYen(d.priceAtDecision)}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[section, { gap: space.sm }]}>
          <Button
            label="サイズ比較で判定"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/compare',
                params: { candidateId: itemId },
              })
            }
            variant="secondary"
          />
          <Button label="Buy として記録" onPress={() => openDecision('buy')} />
          <Button label="Watch にする" onPress={() => openDecision('watch')} variant="secondary" />
          <Button label="Skip にする" onPress={() => openDecision('skip')} variant="ghost" />
          <Button label="Lost Auction にする" onPress={markLostAuction} variant="ghost" />
          <Button label="編集" onPress={() => setEditing(true)} variant="ghost" />
          <Button label="削除" onPress={onDelete} variant="ghost" />
        </View>
      </ScrollView>

      <DecisionReasonModal
        visible={decisionDraft !== null}
        decision={decisionDraft}
        submitting={decisionSubmitting}
        onCancel={() => {
          setDecisionDraft(null);
          setPendingScore(null);
        }}
        onSubmit={onDecisionSubmit}
      />

      <MeasurementExtractionReviewModal
        visible={extractionVisible}
        category={loaded.item.category}
        initialText={loaded.candidate?.listingDescription ?? ''}
        submitting={extractionSubmitting}
        onCancel={() => setExtractionVisible(false)}
        onAdopt={onAdoptExtractedMeasurements}
      />

      <ReminderSettingsModal
        visible={reminderModalVisible}
        auctionEndsAt={loaded.candidate?.auctionEndsAt ?? undefined}
        initial={{
          enabled: loaded.reminders.some((r) => r.isEnabled),
          leadTimes: deriveLeadTimes(
            loaded.reminders.filter((r) => r.isEnabled),
            loaded.candidate?.auctionEndsAt ?? undefined,
          ),
        }}
        submitting={reminderSubmitting}
        onCancel={() => setReminderModalVisible(false)}
        onSubmit={onReminderSubmit}
      />
    </View>
  );
}

const Kv = ({ k, v, emphasize }: { k: string; v: string; emphasize?: boolean }) => (
  <View style={kvRow}>
    <Text style={kvKey}>{k}</Text>
    <LinkText
      style={[kvVal, emphasize ? { color: colors.warning, fontWeight: font.weight.bold } : null]}
    >
      {v}
    </LinkText>
  </View>
);

const center: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  padding: space.xl,
  backgroundColor: colors.bg,
};

const muted = {
  color: colors.textMuted,
  fontSize: font.size.sm,
} as const;

const photoStrip: ViewStyle = {
  paddingVertical: space.md,
};

const photoLarge = {
  width: 240,
  height: 240,
  marginLeft: space.lg,
  borderRadius: radii.md,
} as const;

const photoPlaceholder: ViewStyle = {
  width: 240,
  height: 240,
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  alignItems: 'center',
  justifyContent: 'center',
};

const section: ViewStyle = {
  paddingHorizontal: space.lg,
  paddingVertical: space.lg,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
};

const snapshotsHeader: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: space.sm,
};

const titleStyle = {
  fontSize: font.size.xl,
  fontWeight: font.weight.bold,
  color: colors.text,
} as const;

const subtitleStyle = {
  marginTop: space.xs,
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;

const sectionTitle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  fontWeight: font.weight.semibold,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: space.sm,
} as const;

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

const kvKey = {
  width: 96,
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;

const kvVal = {
  flex: 1,
  fontSize: font.size.sm,
  color: colors.text,
} as const;

const editLink = {
  color: colors.text,
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  paddingHorizontal: space.md,
} as const;

const addLink = {
  color: colors.text,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
} as const;

const warning = {
  marginTop: space.sm,
  color: colors.warning,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
} as const;

const decisionLogRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: space.sm,
  paddingVertical: space.sm,
  borderTopWidth: 1,
  borderTopColor: colors.border,
};

const decisionBadge: ViewStyle = {
  paddingHorizontal: space.sm,
  paddingVertical: 2,
  borderRadius: radii.sm,
  borderWidth: 1,
  alignSelf: 'flex-start',
  minWidth: 64,
  alignItems: 'center',
};

const decisionBadgeText = {
  fontSize: font.size.xs,
  fontWeight: font.weight.bold,
  letterSpacing: 0.5,
} as const;

const decisionDateText = {
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const decisionReasonText = {
  marginTop: 2,
  fontSize: font.size.sm,
  color: colors.text,
} as const;

const brandGuideCard: ViewStyle = {
  paddingHorizontal: space.md,
  paddingVertical: space.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  backgroundColor: colors.surface,
  marginBottom: space.sm,
};

const brandGuideTitle = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: colors.text,
} as const;

const brandGuideNotes = {
  marginTop: space.xs,
  fontSize: font.size.sm,
  color: colors.text,
  lineHeight: 20,
} as const;
