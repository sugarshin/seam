import { forwardRef } from 'react';
import {
  TextInput,
  Text,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, font, radii, space } from '../theme';

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
  return (
    <View style={[wrapper, containerStyle]}>
      {label !== undefined && (
        <Text style={labelStyle}>
          {label}
          {required && <Text style={requiredMark}> *</Text>}
        </Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          inputStyle,
          multiline && { minHeight: 88, textAlignVertical: 'top' as const },
          error !== undefined && error !== '' ? { borderColor: colors.warning } : null,
        ]}
        {...inputProps}
      />
      {error !== undefined && error !== '' ? (
        <Text style={errorStyle}>{error}</Text>
      ) : hint !== undefined && hint !== '' ? (
        <Text style={hintStyle}>{hint}</Text>
      ) : null}
    </View>
  );
});

const wrapper: ViewStyle = {
  marginBottom: space.md,
};

const labelStyle = {
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: colors.textMuted,
  marginBottom: space.xs,
} as const;

const requiredMark = {
  color: colors.warning,
} as const;

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  paddingVertical: space.sm + 2,
  paddingHorizontal: space.md,
  fontSize: font.size.md,
  color: colors.text,
  backgroundColor: colors.bg,
} as const;

const errorStyle = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.warning,
} as const;

const hintStyle = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;
