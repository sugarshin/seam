import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SEVERITY_LABEL, type MeasurementDiffSeverity } from '@seam/shared';
import { colors, font, radii, space } from '../theme';

type Props = {
  severity: MeasurementDiffSeverity;
  /** Override the label (default uses SEVERITY_LABEL). */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export const SeverityBadge = ({ severity, label, style }: Props) => {
  const palette = paletteFor(severity);
  return (
    <View style={[base, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      <Text style={[labelStyle, { color: palette.fg }]}>{label ?? SEVERITY_LABEL[severity]}</Text>
    </View>
  );
};

const paletteFor = (
  severity: MeasurementDiffSeverity,
): { bg: string; fg: string; border: string } => {
  switch (severity) {
    case 'same':
      return { bg: '#EAF4EC', fg: colors.same, border: colors.same };
    case 'close':
      return { bg: '#F0F5E8', fg: colors.close, border: colors.close };
    case 'different':
      return { bg: '#FBF1DD', fg: colors.different, border: colors.different };
    case 'warning':
      return { bg: '#FBE7E7', fg: colors.warning, border: colors.warning };
  }
};

const base: ViewStyle = {
  paddingHorizontal: space.sm,
  paddingVertical: 2,
  borderRadius: radii.sm,
  borderWidth: 1,
  alignSelf: 'flex-start',
};

const labelStyle = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
} as const;
