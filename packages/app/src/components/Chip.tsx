import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

export type ChipTone = 'default' | 'inverse' | 'muted' | 'warning';

type Props = {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const Chip = ({
  label,
  tone = 'default',
  selected = false,
  onPress,
  onRemove,
  style,
  testID,
}: Props) => {
  const palette = useThemeColors();
  const tonePalette = tonePaletteFor(palette);
  const swatch = tonePalette[selected ? 'inverse' : tone];
  const content = (
    <View style={[base, { backgroundColor: swatch.bg, borderColor: swatch.border }, style]}>
      <Text style={[labelStyle, { color: swatch.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {onRemove && (
        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [removeBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[removeMark, { color: swatch.fg }]}>×</Text>
        </Pressable>
      )}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

const base: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: space.md,
  paddingVertical: space.xs + 2,
  borderRadius: radii.lg,
  borderWidth: 1,
  alignSelf: 'flex-start',
};

const labelStyle = {
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
} as const;

const removeBtn: ViewStyle = {
  marginLeft: space.xs,
};

const removeMark = {
  fontSize: font.size.md,
  fontWeight: font.weight.bold,
} as const;

const tonePaletteFor = (
  p: ColorPalette,
): Record<ChipTone, { bg: string; fg: string; border: string }> => ({
  default: { bg: p.surface, fg: p.text, border: p.border },
  inverse: { bg: p.bgInverse, fg: p.textInverse, border: p.bgInverse },
  muted: { bg: p.bg, fg: p.textMuted, border: p.border },
  warning: { bg: p.bg, fg: p.warning, border: p.warning },
});
