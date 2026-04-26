import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radii, space } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  fullWidth = false,
}: Props) => {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
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
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.text} />
      ) : (
        <Text style={[labelBase, labelStyle[variant]]}>{label}</Text>
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

const variantStyle: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.bgInverse,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
};

const labelBase = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
} as const;

const labelStyle: Record<ButtonVariant, { color: string }> = {
  primary: { color: colors.textInverse },
  secondary: { color: colors.text },
  ghost: { color: colors.text },
};
