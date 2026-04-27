import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, font, radii, space } from '../theme';

export type PickerOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label?: string;
  value: T | undefined;
  options: readonly PickerOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  modalTitle?: string;
};

export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = '選択してください',
  error,
  required,
  containerStyle,
  modalTitle,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const renderRow = ({ item }: ListRenderItemInfo<PickerOption<T>>) => {
    const selected = item.value === value;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onChange(item.value);
          setOpen(false);
        }}
        style={({ pressed }) => [
          rowStyle,
          selected && { backgroundColor: colors.surface },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={[rowLabel, selected && { fontWeight: font.weight.semibold }]}>
          {item.label}
        </Text>
        {selected && <Text style={checkMark}>✓</Text>}
      </Pressable>
    );
  };

  return (
    <View style={[wrapper, containerStyle]}>
      {label !== undefined && (
        <Text style={labelStyle}>
          {label}
          {required && <Text style={requiredMark}> *</Text>}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          fieldStyle,
          pressed && { opacity: 0.7 },
          error !== undefined && error !== '' ? { borderColor: colors.warning } : null,
        ]}
      >
        <Text style={current ? valueStyle : placeholderStyle}>
          {current ? current.label : placeholder}
        </Text>
        <Text style={chevron}>›</Text>
      </Pressable>
      {error !== undefined && error !== '' ? <Text style={errorStyle}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={backdrop} onPress={() => setOpen(false)} />
        <View style={sheet}>
          {modalTitle !== undefined && <Text style={sheetTitle}>{modalTitle}</Text>}
          <FlatList
            data={[...options]}
            keyExtractor={(item) => item.value}
            renderItem={renderRow}
            ItemSeparatorComponent={() => <View style={separator} />}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={({ pressed }) => [cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={cancelLabel}>キャンセル</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const wrapper: ViewStyle = {
  marginBottom: space.md,
};

const labelStyle = {
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: colors.textMuted,
  marginBottom: space.xs,
} as const;

const requiredMark = { color: colors.warning } as const;

const fieldStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  paddingVertical: space.sm + 2,
  paddingHorizontal: space.md,
  backgroundColor: colors.bg,
  minHeight: 44,
};

const valueStyle = {
  flex: 1,
  fontSize: font.size.md,
  color: colors.text,
} as const;

const placeholderStyle = {
  flex: 1,
  fontSize: font.size.md,
  color: colors.textMuted,
} as const;

const chevron = {
  fontSize: font.size.lg,
  color: colors.textMuted,
  transform: [{ rotate: '90deg' }],
} as const;

const errorStyle = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.warning,
} as const;

const backdrop: ViewStyle = {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.35)',
};

const sheet: ViewStyle = {
  backgroundColor: colors.bg,
  borderTopLeftRadius: radii.lg,
  borderTopRightRadius: radii.lg,
  paddingTop: space.md,
  paddingBottom: space.xl,
  maxHeight: '70%',
};

const sheetTitle = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: colors.text,
  paddingHorizontal: space.lg,
  paddingBottom: space.md,
} as const;

const rowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
};

const rowLabel = {
  flex: 1,
  fontSize: font.size.md,
  color: colors.text,
} as const;

const checkMark = {
  fontSize: font.size.md,
  color: colors.text,
} as const;

const separator: ViewStyle = {
  height: 1,
  backgroundColor: colors.border,
  marginHorizontal: space.lg,
};

const cancelBtn: ViewStyle = {
  marginTop: space.md,
  marginHorizontal: space.lg,
  paddingVertical: space.md,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
};

const cancelLabel = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: colors.text,
} as const;
