import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SCORE_WEIGHTS, type CandidateEvaluation } from '@seam/shared';
import { colors, font, radii, space } from '../theme';

type Factor = {
  key: string;
  label: string;
  value: number;
  /** Relative importance — used purely for the small "wt" label, not for the bar. */
  weight: number;
};

type Props = {
  /** Each value is in [0, 100]. */
  breakdown: {
    sizeScore: number;
    priceScore: number;
    conditionScore: number;
    uniquenessScore: number;
    duplicateInverseScore: number;
    weightedTotal: number;
    ngPenalty: number;
  };
  style?: StyleProp<ViewStyle>;
};

export const ScoreBreakdown = ({ breakdown, style }: Props) => {
  const factors: Factor[] = [
    { key: 'size', label: 'サイズ', value: breakdown.sizeScore, weight: SCORE_WEIGHTS.size },
    { key: 'price', label: '価格', value: breakdown.priceScore, weight: SCORE_WEIGHTS.price },
    {
      key: 'condition',
      label: 'コンディション',
      value: breakdown.conditionScore,
      weight: SCORE_WEIGHTS.condition,
    },
    {
      key: 'uniqueness',
      label: 'ユニークさ',
      value: breakdown.uniquenessScore,
      weight: SCORE_WEIGHTS.uniqueness,
    },
    {
      key: 'duplicateInverse',
      label: '非重複度',
      value: breakdown.duplicateInverseScore,
      weight: SCORE_WEIGHTS.duplicateInverse,
    },
  ];

  return (
    <View style={[wrapper, style]}>
      {factors.map((f) => (
        <View key={f.key} style={row}>
          <View style={head}>
            <Text style={label}>{f.label}</Text>
            <Text style={weightHint}>×{f.weight.toFixed(2)}</Text>
            <Text style={value}>{Math.round(f.value)}</Text>
          </View>
          <View style={track}>
            <View
              style={[
                fill,
                {
                  width: `${Math.max(0, Math.min(100, f.value))}%`,
                  backgroundColor: barColor(f.value),
                },
              ]}
            />
          </View>
        </View>
      ))}

      {breakdown.ngPenalty > 0 && (
        <View style={penaltyRow}>
          <Text style={penaltyLabel}>NG ペナルティ</Text>
          <Text style={penaltyValue}>− {breakdown.ngPenalty}</Text>
        </View>
      )}
    </View>
  );
};

/** Pull a CandidateEvaluation row into the shape ScoreBreakdown expects. */
export const breakdownFromEvaluation = (
  ev: CandidateEvaluation,
): Props['breakdown'] => ({
  sizeScore: ev.sizeScore,
  priceScore: ev.priceScore,
  conditionScore: ev.conditionScore,
  uniquenessScore: ev.uniquenessScore,
  duplicateInverseScore: 100 - ev.duplicateRiskScore,
  weightedTotal: ev.totalScore, // approximation when penalty is unknown
  ngPenalty: 0,
});

const barColor = (v: number): string => {
  if (v >= 80) return colors.same;
  if (v >= 60) return colors.close;
  if (v >= 40) return colors.different;
  return colors.warning;
};

const wrapper: ViewStyle = {
  gap: space.sm,
};

const row: ViewStyle = {
  gap: space.xs,
};

const head: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: space.sm,
};

const label = {
  flex: 1,
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.medium,
} as const;

const weightHint = {
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const value = {
  width: 36,
  textAlign: 'right' as const,
  fontSize: font.size.md,
  color: colors.text,
  fontWeight: font.weight.semibold,
};

const track: ViewStyle = {
  height: 8,
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  overflow: 'hidden',
};

const fill: ViewStyle = {
  height: '100%',
  borderRadius: radii.sm,
};

const penaltyRow: ViewStyle = {
  marginTop: space.sm,
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingTop: space.sm,
  borderTopWidth: 1,
  borderTopColor: colors.border,
};

const penaltyLabel = {
  fontSize: font.size.sm,
  color: colors.warning,
  fontWeight: font.weight.semibold,
} as const;

const penaltyValue = {
  fontSize: font.size.sm,
  color: colors.warning,
  fontWeight: font.weight.bold,
} as const;
