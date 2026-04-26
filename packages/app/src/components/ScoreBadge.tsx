import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ScoreDecision } from '@seam/shared';
import { colors, font, radii, space } from '../theme';

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

const paletteFor = (
  decision: ScoreDecision,
): { bg: string; fg: string; pillBg: string; pillFg: string } => {
  switch (decision) {
    case 'buy':
      return { bg: '#EAF4EC', fg: colors.same, pillBg: colors.same, pillFg: colors.textInverse };
    case 'watch':
      return {
        bg: '#FBF1DD',
        fg: colors.different,
        pillBg: colors.different,
        pillFg: colors.textInverse,
      };
    case 'skip':
      return {
        bg: '#FBE7E7',
        fg: colors.warning,
        pillBg: colors.warning,
        pillFg: colors.textInverse,
      };
  }
};

export const ScoreBadge = ({ totalScore, decision, style }: Props) => {
  const palette = paletteFor(decision);
  const rounded = Math.round(totalScore);
  return (
    <View style={[card, { backgroundColor: palette.bg }, style]}>
      <View style={scoreColumn}>
        <Text style={[scoreNumber, { color: palette.fg }]}>{rounded}</Text>
        <Text style={[scoreOutOf, { color: palette.fg }]}>/ 100</Text>
      </View>
      <View style={[pill, { backgroundColor: palette.pillBg }]}>
        <Text style={[pillLabel, { color: palette.pillFg }]}>{DECISION_LABEL[decision]}</Text>
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
