import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SCORE_WEIGHTS, type CandidateEvaluation } from '@seam/shared';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

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
  const palette = useThemeColors();
  const styles = makeStyles(palette);
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
            <Text style={styles.label}>{f.label}</Text>
            <Text style={styles.weightHint}>×{f.weight.toFixed(2)}</Text>
            <Text style={styles.value}>{Math.round(f.value)}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                fill,
                {
                  width: `${Math.max(0, Math.min(100, f.value))}%`,
                  backgroundColor: barColor(f.value, palette),
                },
              ]}
            />
          </View>
        </View>
      ))}

      {breakdown.ngPenalty > 0 && (
        <View style={styles.penaltyRow}>
          <Text style={styles.penaltyLabel}>NG ペナルティ</Text>
          <Text style={styles.penaltyValue}>− {breakdown.ngPenalty}</Text>
        </View>
      )}
    </View>
  );
};

/** Pull a CandidateEvaluation row into the shape ScoreBreakdown expects. */
export const breakdownFromEvaluation = (ev: CandidateEvaluation): Props['breakdown'] => ({
  sizeScore: ev.sizeScore,
  priceScore: ev.priceScore,
  conditionScore: ev.conditionScore,
  uniquenessScore: ev.uniquenessScore,
  duplicateInverseScore: 100 - ev.duplicateRiskScore,
  weightedTotal: ev.totalScore, // approximation when penalty is unknown
  ngPenalty: 0,
});

const barColor = (v: number, p: ColorPalette): string => {
  if (v >= 80) return p.same;
  if (v >= 60) return p.close;
  if (v >= 40) return p.different;
  return p.warning;
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

const fill: ViewStyle = {
  height: '100%',
  borderRadius: radii.sm,
};

const makeStyles = (p: ColorPalette) => ({
  label: {
    flex: 1,
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.medium,
  } as const,
  weightHint: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  value: {
    width: 36,
    textAlign: 'right' as const,
    fontSize: font.size.md,
    color: p.text,
    fontWeight: font.weight.semibold,
  },
  track: {
    height: 8,
    backgroundColor: p.surface,
    borderRadius: radii.sm,
    overflow: 'hidden' as const,
  } satisfies ViewStyle,
  penaltyRow: {
    marginTop: space.sm,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: p.border,
  } satisfies ViewStyle,
  penaltyLabel: {
    fontSize: font.size.sm,
    color: p.warning,
    fontWeight: font.weight.semibold,
  } as const,
  penaltyValue: {
    fontSize: font.size.sm,
    color: p.warning,
    fontWeight: font.weight.bold,
  } as const,
});
