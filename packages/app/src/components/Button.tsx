import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  fullWidth = false,
  testID,
  accessibilityLabel,
}: Props) => {
  const palette = useThemeColors();
  const variantStyle = variantStyles(palette);
  const labelColors = labelColorMap(palette);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        baseStyle,
        variantStyle[variant],
        fullWidth && { alignSelf: 'stretch' as const },
        (pressed || isDisabled) && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.textInverse : palette.text} />
      ) : (
        <Text style={[labelBase, { color: labelColors[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
};

const baseStyle: ViewStyle = {
  paddingVertical: space.md,
  paddingHorizontal: space.lg,
  borderRadius: radii.md,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
};

const variantStyles = (p: ColorPalette): Record<ButtonVariant, ViewStyle> => ({
  primary: {
    backgroundColor: p.bgInverse,
  },
  secondary: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const labelBase = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
} as const;

const labelColorMap = (p: ColorPalette): Record<ButtonVariant, string> => ({
  primary: p.textInverse,
  secondary: p.text,
  ghost: p.text,
});
