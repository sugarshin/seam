import { forwardRef } from 'react';
import {
  TextInput,
  Text,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, required, containerStyle, multiline, ...inputProps },
  ref,
) {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  return (
    <View style={[wrapper, containerStyle]}>
      {label !== undefined && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={palette.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 88, textAlignVertical: 'top' as const },
          error !== undefined && error !== '' ? { borderColor: palette.warning } : null,
        ]}
        {...inputProps}
      />
      {error !== undefined && error !== '' ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint !== undefined && hint !== '' ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const wrapper: ViewStyle = {
  marginBottom: space.md,
};

const makeStyles = (p: ColorPalette) => ({
  label: {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: p.textMuted,
    marginBottom: space.xs,
  } as const,
  requiredMark: {
    color: p.warning,
  } as const,
  input: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    fontSize: font.size.md,
    color: p.text,
    backgroundColor: p.bg,
  } as const,
  error: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.warning,
  } as const,
  hint: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
});
