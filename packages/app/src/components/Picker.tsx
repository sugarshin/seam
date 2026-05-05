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
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

export type PickerOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
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
  /**
   * testID for the trigger field. Option rows derive `option:<name>:<value>`
   * (where `<name>` is `testID` with a `picker:` prefix stripped). Cancel
   * button derives `<testID>:cancel`.
   */
  testID?: string;
};

const optionTestIdFor = (rootId: string, value: string): string => {
  const stripped = rootId.startsWith('picker:') ? rootId.slice('picker:'.length) : rootId;
  return `option:${stripped}:${value}`;
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
  testID,
}: Props<T>) {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const renderRow = ({ item }: ListRenderItemInfo<PickerOption<T>>) => {
    const selected = item.value === value;
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID !== undefined ? optionTestIdFor(testID, item.value) : undefined}
        onPress={() => {
          onChange(item.value);
          setOpen(false);
        }}
        style={({ pressed }) => [
          rowStyle,
          selected && { backgroundColor: palette.surface },
          pressed && { opacity: 0.6 },
        ]}
      >
        <View style={rowTextWrap}>
          <Text style={[styles.rowLabel, selected && { fontWeight: font.weight.semibold }]}>
            {item.label}
          </Text>
          {item.description !== undefined && item.description !== '' && (
            <Text style={styles.rowDescription}>{item.description}</Text>
          )}
        </View>
        {selected && <Text style={styles.checkMark}>✓</Text>}
      </Pressable>
    );
  };

  return (
    <View style={[wrapper, containerStyle]}>
      {label !== undefined && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          pressed && { opacity: 0.7 },
          error !== undefined && error !== '' ? { borderColor: palette.warning } : null,
        ]}
      >
        <Text style={current ? styles.value : styles.placeholder}>
          {current ? current.label : placeholder}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {error !== undefined && error !== '' ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          {modalTitle !== undefined && <Text style={styles.sheetTitle}>{modalTitle}</Text>}
          <FlatList
            data={[...options]}
            keyExtractor={(item) => item.value}
            renderItem={renderRow}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <Pressable
            accessibilityRole="button"
            testID={testID !== undefined ? `${testID}:cancel` : undefined}
            onPress={() => setOpen(false)}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelLabel}>キャンセル</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const wrapper: ViewStyle = {
  marginBottom: space.md,
};

const rowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
};

const rowTextWrap: ViewStyle = {
  flex: 1,
};

const backdrop: ViewStyle = {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.35)',
};

const makeStyles = (p: ColorPalette) => ({
  label: {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: p.textMuted,
    marginBottom: space.xs,
  } as const,
  requiredMark: { color: p.warning } as const,
  field: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    backgroundColor: p.bg,
    minHeight: 44,
  } satisfies ViewStyle,
  value: {
    flex: 1,
    fontSize: font.size.md,
    color: p.text,
  } as const,
  placeholder: {
    flex: 1,
    fontSize: font.size.md,
    color: p.textMuted,
  } as const,
  chevron: {
    fontSize: font.size.lg,
    color: p.textMuted,
    transform: [{ rotate: '90deg' as const }],
  } as const,
  error: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.warning,
  } as const,
  sheet: {
    backgroundColor: p.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    maxHeight: '70%' as const,
  } satisfies ViewStyle,
  sheetTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: p.text,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  } as const,
  rowLabel: {
    fontSize: font.size.md,
    color: p.text,
  } as const,
  rowDescription: {
    marginTop: 2,
    fontSize: font.size.xs,
    color: p.textMuted,
    lineHeight: font.size.xs * 1.4,
  } as const,
  checkMark: {
    fontSize: font.size.md,
    color: p.text,
  } as const,
  separator: {
    height: 1,
    backgroundColor: p.border,
    marginHorizontal: space.lg,
  } satisfies ViewStyle,
  cancelBtn: {
    marginTop: space.md,
    marginHorizontal: space.lg,
    paddingVertical: space.md,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
  } satisfies ViewStyle,
  cancelLabel: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: p.text,
  } as const,
});
