import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SEVERITY_LABEL, type MeasurementDiffSeverity } from '@seam/shared';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  severity: MeasurementDiffSeverity;
  /** Override the label (default uses SEVERITY_LABEL). */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export const SeverityBadge = ({ severity, label, style }: Props) => {
  const palette = useThemeColors();
  const swatch = paletteFor(severity, palette);
  return (
    <View style={[base, { backgroundColor: swatch.bg, borderColor: swatch.border }, style]}>
      <Text style={[labelStyle, { color: swatch.fg }]}>{label ?? SEVERITY_LABEL[severity]}</Text>
    </View>
  );
};

// Background tints are derived from the semantic accent so dark mode keeps
// adequate contrast without going fully saturated.
const tintFor = (severity: MeasurementDiffSeverity, p: ColorPalette): string => {
  switch (severity) {
    case 'same':
      return p.bg === '#0E0E0E' ? '#1B2A1F' : '#EAF4EC';
    case 'close':
      return p.bg === '#0E0E0E' ? '#212B19' : '#F0F5E8';
    case 'different':
      return p.bg === '#0E0E0E' ? '#2C2418' : '#FBF1DD';
    case 'warning':
      return p.bg === '#0E0E0E' ? '#2C1A1A' : '#FBE7E7';
  }
};

const paletteFor = (
  severity: MeasurementDiffSeverity,
  p: ColorPalette,
): { bg: string; fg: string; border: string } => {
  const fg = p[severity];
  return { bg: tintFor(severity, p), fg, border: fg };
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
