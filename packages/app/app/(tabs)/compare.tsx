import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  CATEGORY_LABEL,
  MEASUREMENT_KEY_LABEL,
  type FitAnchor,
  type GarmentItem,
  type Measurement,
  type ScoreDecision,
} from '@seam/shared';
import {
  compareMeasurements,
  getMeasurementDiffSeverity,
  suggestSimilarItems,
  type MeasurementDiff,
} from '@seam/domain';
import { Button } from '../../src/components/Button';
import { DecisionReasonModal } from '../../src/components/DecisionReasonModal';
import { DiffRow } from '../../src/components/DiffRow';
import { EmptyState } from '../../src/components/EmptyState';
import { Picker, type PickerOption } from '../../src/components/Picker';
import { ScoreBadge } from '../../src/components/ScoreBadge';
import { ScoreBreakdown } from '../../src/components/ScoreBreakdown';
import { SeverityBadge } from '../../src/components/SeverityBadge';
import { fitAnchorRepository, itemRepository, measurementRepository } from '../../src/repositories';
import {
  computeCandidateScore,
  recordDecision,
  type ComputeCandidateScoreResult,
} from '../../src/scoring';
import { colors, font, radii, space } from '../../src/theme';

type CandidateLite = {
  item: GarmentItem;
  measurements: Measurement[];
};

type AnchorLite = {
  anchor: FitAnchor;
  item: GarmentItem;
  measurements: Measurement[];
};

type OwnedLite = {
  item: GarmentItem;
  measurements: Measurement[];
};

export default function CompareScreen() {
  const params = useLocalSearchParams<{ candidateId?: string }>();
  const initialCandidateId =
    typeof params.candidateId === 'string' ? params.candidateId : undefined;

  const [candidates, setCandidates] = useState<GarmentItem[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(
    initialCandidateId,
  );
  const [candidate, setCandidate] = useState<CandidateLite | null>(null);
  const [anchors, setAnchors] = useState<AnchorLite[]>([]);
  const [ownedSameCategory, setOwnedSameCategory] = useState<OwnedLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOwnedId, setExpandedOwnedId] = useState<string | null>(null);
  const [score, setScore] = useState<ComputeCandidateScoreResult | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<ScoreDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCandidatesList = useCallback(async () => {
    const list = await itemRepository.listCandidates();
    setCandidates(list);
    if (!selectedCandidateId && list[0]) setSelectedCandidateId(list[0].id);
  }, [selectedCandidateId]);

  useFocusEffect(
    useCallback(() => {
      void loadCandidatesList();
    }, [loadCandidatesList]),
  );

  useEffect(() => {
    if (initialCandidateId) setSelectedCandidateId(initialCandidateId);
  }, [initialCandidateId]);

  const loadAll = useCallback(async (candidateId: string) => {
    setLoading(true);
    try {
      const item = await itemRepository.getById(candidateId);
      if (!item) {
        setCandidate(null);
        setAnchors([]);
        setOwnedSameCategory([]);
        setScore(null);
        return;
      }
      const candidateMeasurements = await measurementRepository.listByItem(item.id);
      setCandidate({ item, measurements: candidateMeasurements });

      const anchorRows = await fitAnchorRepository.listByCategory(item.category);
      const anchorEnriched = await Promise.all(
        anchorRows.map(async (a) => {
          const [it, ms] = await Promise.all([
            itemRepository.getById(a.itemId),
            measurementRepository.listByItem(a.itemId),
          ]);
          return it ? { anchor: a, item: it, measurements: ms } : null;
        }),
      );
      setAnchors(anchorEnriched.filter((x): x is AnchorLite => x !== null));

      const ownedAll = await itemRepository.listOwned();
      const ownedSameCat = ownedAll.filter((o) => o.category === item.category && o.id !== item.id);
      const ownedEnriched = await Promise.all(
        ownedSameCat.map(async (o) => ({
          item: o,
          measurements: await measurementRepository.listByItem(o.id),
        })),
      );
      setOwnedSameCategory(ownedEnriched);

      // Composite score across all 5 factors. The orchestrator pulls rules /
      // owned items / anchors from the repositories, so we don't need to fetch
      // them separately for the score calc.
      const computed = await computeCandidateScore(item.id);
      setScore(computed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCandidateId) void loadAll(selectedCandidateId);
  }, [selectedCandidateId, loadAll]);

  // ─── derived ────────────────────────────────────────────────────────────
  const violations = score?.ruleViolations ?? [];

  const similar = useMemo(() => {
    if (!candidate) return [];
    const ownedItems = ownedSameCategory.map((o) => o.item);
    return suggestSimilarItems(candidate.item, ownedItems, { limit: 5 });
  }, [candidate, ownedSameCategory]);

  const candidateOptions: readonly PickerOption<string>[] = useMemo(
    () => candidates.map((c) => ({ value: c.id, label: c.name })),
    [candidates],
  );

  // ─── decision flow ──────────────────────────────────────────────────────
  const onDecisionSubmit = useCallback(
    (reason: string) => {
      if (!candidate || !decisionDraft) return;
      setSubmitting(true);
      void (async () => {
        try {
          await recordDecision({
            itemId: candidate.item.id,
            decision: decisionDraft,
            reason,
            score: score ?? undefined,
          });
          setDecisionDraft(null);
          if (decisionDraft === 'buy') {
            // Bought items live under /item/[id]; jump there directly.
            router.replace({ pathname: '/item/[id]', params: { id: candidate.item.id } });
          } else {
            // Re-fetch candidates and reset selection so the list reflects the move.
            await loadCandidatesList();
            setSelectedCandidateId(undefined);
            setCandidate(null);
            setScore(null);
          }
        } catch (err) {
          Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
        } finally {
          setSubmitting(false);
        }
      })();
    },
    [candidate, decisionDraft, loadCandidatesList, score],
  );

  // ─── render ─────────────────────────────────────────────────────────────
  if (loading && !candidate) {
    return (
      <View style={center}>
        <Text style={muted}>読み込み中…</Text>
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="比較する候補がありません"
        message="Wishlist タブから候補を追加してください。"
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
    >
      <View style={section}>
        <Picker<string>
          label="比較する候補"
          value={selectedCandidateId}
          options={candidateOptions}
          onChange={setSelectedCandidateId}
          modalTitle="候補を選択"
        />
      </View>

      {candidate && (
        <>
          <View style={section}>
            <Text style={titleStyle}>{candidate.item.name}</Text>
            <Text style={subtitleStyle}>
              {[candidate.item.brand, CATEGORY_LABEL[candidate.item.category]]
                .filter((s): s is string => Boolean(s))
                .join(' · ')}
            </Text>
            {score && (
              <View style={{ marginTop: space.md, gap: space.md }}>
                <ScoreBadge totalScore={score.totalScore} decision={score.decision} />
                <ScoreBreakdown breakdown={score.breakdown} />
              </View>
            )}
          </View>

          {violations.length > 0 && (
            <View style={[section, ngBox]}>
              <Text style={ngTitle}>個人ルール違反</Text>
              {violations.map((v) => (
                <View key={v.ruleId} style={ngRow}>
                  <SeverityBadge
                    severity={v.severity === 'ng' ? 'warning' : 'different'}
                    label={v.severity === 'ng' ? 'NG' : 'WARN'}
                  />
                  <Text style={ngMessage}>
                    {MEASUREMENT_KEY_LABEL[v.measurementKey]}: {v.message}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={section}>
            <Text style={sectionTitle}>候補の実寸</Text>
            {candidate.measurements.length === 0 ? (
              <Text style={muted}>実寸が登録されていません。</Text>
            ) : (
              candidate.measurements.map((m) => (
                <View key={m.id} style={kvRow}>
                  <Text style={kvKey}>{MEASUREMENT_KEY_LABEL[m.key]}</Text>
                  <Text style={kvVal}>
                    {m.value} {m.unit}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={section}>
            <Text style={sectionTitle}>Fit Anchor との差分</Text>
            {anchors.length === 0 ? (
              <Text style={muted}>同カテゴリの Fit Anchor がありません。</Text>
            ) : (
              anchors.map((a) => (
                <DiffsBlock
                  key={a.anchor.id}
                  title={a.anchor.name}
                  subtitle={a.item.name}
                  diffs={compareMeasurements(
                    candidate.measurements,
                    a.measurements,
                    candidate.item.category,
                  )}
                  category={candidate.item.category}
                />
              ))
            )}
          </View>

          <View style={section}>
            <Text style={sectionTitle}>所有アイテムとの差分</Text>
            {ownedSameCategory.length === 0 ? (
              <Text style={muted}>同カテゴリの所有アイテムがありません。</Text>
            ) : (
              ownedSameCategory.map((o) => {
                const expanded = expandedOwnedId === o.item.id;
                const diffs = compareMeasurements(
                  candidate.measurements,
                  o.measurements,
                  candidate.item.category,
                );
                return (
                  <View key={o.item.id} style={ownedItemBox}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setExpandedOwnedId(expanded ? null : o.item.id)}
                      style={({ pressed }) => [ownedHeader, pressed && { opacity: 0.7 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={ownedName}>{o.item.name}</Text>
                        {o.item.brand && <Text style={ownedSubtitle}>{o.item.brand}</Text>}
                      </View>
                      <Text style={chevron}>{expanded ? '▾' : '▸'}</Text>
                    </Pressable>
                    {expanded && (
                      <View style={ownedBody}>
                        {diffs.length === 0 ? (
                          <Text style={muted}>共通する実寸がありません。</Text>
                        ) : (
                          diffs.map((d) => (
                            <DiffRow
                              key={d.key}
                              measurementKey={d.key}
                              candidateValue={d.candidateValue}
                              referenceValue={d.referenceValue}
                              unit={unitFor(o.measurements, d) ?? 'cm'}
                              diffCm={d.diffCm}
                              severity={getMeasurementDiffSeverity(d, candidate.item.category)}
                              comparable={d.comparable}
                            />
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {similar.length > 0 && (
            <View style={section}>
              <Text style={sectionTitle}>似ているアイテム</Text>
              {similar.map((s) => (
                <Text key={s.id} style={similarItem}>
                  {s.name}
                  {s.brand ? ` · ${s.brand}` : ''}
                </Text>
              ))}
            </View>
          )}

          <View style={[section, { gap: space.sm }]}>
            <Button label="Buy として記録" onPress={() => setDecisionDraft('buy')} />
            <Button
              label="Watch にする"
              onPress={() => setDecisionDraft('watch')}
              variant="secondary"
            />
            <Button label="Skip にする" onPress={() => setDecisionDraft('skip')} variant="ghost" />
          </View>
        </>
      )}

      <DecisionReasonModal
        visible={decisionDraft !== null}
        decision={decisionDraft}
        submitting={submitting}
        onCancel={() => setDecisionDraft(null)}
        onSubmit={onDecisionSubmit}
      />
    </ScrollView>
  );
}

const unitFor = (measurements: readonly Measurement[], diff: MeasurementDiff): string | undefined =>
  measurements.find((m) => m.key === diff.key)?.unit;

const DiffsBlock = ({
  title,
  subtitle,
  diffs,
  category,
}: {
  title: string;
  subtitle?: string;
  diffs: MeasurementDiff[];
  category: GarmentItem['category'];
}) => {
  return (
    <View style={diffsBlock}>
      <View style={diffsHeader}>
        <Text style={diffsTitle}>{title}</Text>
        {subtitle && <Text style={diffsSubtitle}>{subtitle}</Text>}
      </View>
      {diffs.length === 0 ? (
        <Text style={muted}>共通する実寸がありません。</Text>
      ) : (
        diffs.map((d) => (
          <DiffRow
            key={d.key}
            measurementKey={d.key}
            candidateValue={d.candidateValue}
            referenceValue={d.referenceValue}
            unit="cm"
            diffCm={d.diffCm}
            severity={getMeasurementDiffSeverity(d, category)}
            comparable={d.comparable}
          />
        ))
      )}
    </View>
  );
};

// ─── styles ────────────────────────────────────────────────────────────────
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

const section: ViewStyle = {
  paddingHorizontal: space.lg,
  paddingVertical: space.lg,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
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

const ngBox: ViewStyle = {
  backgroundColor: '#FBE7E7',
};

const ngTitle = {
  fontSize: font.size.sm,
  color: colors.warning,
  fontWeight: font.weight.bold,
  marginBottom: space.sm,
} as const;

const ngRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
  paddingVertical: space.xs,
};

const ngMessage = {
  flex: 1,
  fontSize: font.size.sm,
  color: colors.text,
} as const;

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

const diffsBlock: ViewStyle = {
  marginTop: space.md,
  paddingTop: space.md,
  borderTopWidth: 1,
  borderTopColor: colors.border,
};

const diffsHeader: ViewStyle = {
  marginBottom: space.sm,
};

const diffsTitle = {
  fontSize: font.size.md,
  color: colors.text,
  fontWeight: font.weight.semibold,
} as const;

const diffsSubtitle = {
  marginTop: 2,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const ownedItemBox: ViewStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  marginBottom: space.sm,
  overflow: 'hidden',
};

const ownedHeader: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
  backgroundColor: colors.surface,
};

const ownedName = {
  fontSize: font.size.md,
  color: colors.text,
  fontWeight: font.weight.semibold,
} as const;

const ownedSubtitle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const ownedBody: ViewStyle = {
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
};

const chevron = {
  fontSize: font.size.lg,
  color: colors.textMuted,
} as const;

const similarItem = {
  paddingVertical: space.xs,
  fontSize: font.size.sm,
  color: colors.text,
} as const;
