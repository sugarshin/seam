import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ScoreDecision } from '@seam/shared';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  totalScore: number;
  decision: ScoreDecision;
  style?: StyleProp<ViewStyle>;
};

const DECISION_LABEL: Record<ScoreDecision, string> = {
  buy: 'BUY',
  watch: 'WATCH',
  skip: 'SKIP',
};

const tintFor = (decision: ScoreDecision, p: ColorPalette): string => {
  const isDark = p.bg === '#0E0E0E';
  switch (decision) {
    case 'buy':
      return isDark ? '#1B2A1F' : '#EAF4EC';
    case 'watch':
      return isDark ? '#2C2418' : '#FBF1DD';
    case 'skip':
      return isDark ? '#2C1A1A' : '#FBE7E7';
  }
};

const paletteFor = (
  decision: ScoreDecision,
  p: ColorPalette,
): { bg: string; fg: string; pillBg: string; pillFg: string } => {
  const accent = decision === 'buy' ? p.same : decision === 'watch' ? p.different : p.warning;
  return { bg: tintFor(decision, p), fg: accent, pillBg: accent, pillFg: p.textInverse };
};

export const ScoreBadge = ({ totalScore, decision, style }: Props) => {
  const palette = useThemeColors();
  const swatch = paletteFor(decision, palette);
  const rounded = Math.round(totalScore);
  return (
    <View style={[card, { backgroundColor: swatch.bg }, style]}>
      <View style={scoreColumn}>
        <Text style={[scoreNumber, { color: swatch.fg }]}>{rounded}</Text>
        <Text style={[scoreOutOf, { color: swatch.fg }]}>/ 100</Text>
      </View>
      <View style={[pill, { backgroundColor: swatch.pillBg }]}>
        <Text style={[pillLabel, { color: swatch.pillFg }]}>{DECISION_LABEL[decision]}</Text>
      </View>
    </View>
  );
};

const card: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
  borderRadius: radii.md,
};

const scoreColumn: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: space.sm,
};

const scoreNumber = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
} as const;

const scoreOutOf = {
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
} as const;

const pill: ViewStyle = {
  paddingHorizontal: space.md,
  paddingVertical: space.xs + 2,
  borderRadius: radii.sm,
};

const pillLabel = {
  fontSize: font.size.sm,
  fontWeight: font.weight.bold,
  letterSpacing: 1,
} as const;
