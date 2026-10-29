import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type TextInput,
  type ViewStyle,
} from 'react-native';
import { nameKey, searchBrandOptions } from '@seam/domain/analytics';
import { TextField } from './TextField';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';
import { testIds } from '../utils/testIds';

type Props = {
  label?: string;
  /** Current brand; '' means unset. */
  value: string;
  /** Existing brand labels (see `useBrandOptions`). */
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  modalTitle?: string;
  /**
   * testID for the trigger field. Derived: option rows
   * `option:<name>:<brand>` (`<name>` = testID minus `picker:`), plus
   * `<testID>:search`, `<testID>:create`, `<testID>:clear`, `<testID>:cancel`.
   */
  testID?: string;
};

/**
 * Brand selector that picks from existing labels and only falls back to free
 * text for a brand that isn't registered yet. A query that is a spelling
 * variant of an existing brand ("LEVI'S" vs "Levi's") resolves to that brand
 * instead of offering a new one.
 */
export const BrandPicker = ({
  label,
  value,
  options,
  onChange,
  placeholder = '選択してください',
  error,
  required,
  containerStyle,
  modalTitle = 'ブランドを選択',
  testID,
}: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  // Keep a brand typed in earlier in this form (not saved yet) selectable.
  const pool = useMemo(() => {
    const key = nameKey(value);
    if (key === null || options.some((o) => nameKey(o) === key)) return options;
    return [value.trim(), ...options];
  }, [options, value]);
  const { matches, exact, createLabel } = useMemo(
    () => searchBrandOptions(pool, query),
    [pool, query],
  );
  const valueKey = nameKey(value);
  const showClear = !required && valueKey !== null && query.trim() === '';

  const openSheet = () => {
    setQuery('');
    setOpen(true);
  };
  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const submitQuery = () => {
    const next = exact ?? createLabel;
    if (next !== undefined) select(next);
  };

  const renderRow = ({ item }: ListRenderItemInfo<string>) => {
    const selected = valueKey !== null && nameKey(item) === valueKey;
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID !== undefined ? testIds.optionFor(testID, item) : undefined}
        onPress={() => select(item)}
        style={({ pressed }) => [
          rowStyle,
          selected && { backgroundColor: palette.surface },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={[styles.rowLabel, selected && { fontWeight: font.weight.semibold }]}>
          {item}
        </Text>
        {selected && <Text style={styles.checkMark}>✓</Text>}
      </Pressable>
    );
  };

  const header = (
    <>
      {createLabel !== undefined && (
        <Pressable
          accessibilityRole="button"
          testID={testID !== undefined ? `${testID}:create` : undefined}
          onPress={() => select(createLabel)}
          style={({ pressed }) => [rowStyle, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.createLabel}>＋「{createLabel}」を新しいブランドとして追加</Text>
        </Pressable>
      )}
      {showClear && (
        <Pressable
          accessibilityRole="button"
          testID={testID !== undefined ? `${testID}:clear` : undefined}
          onPress={() => select('')}
          style={({ pressed }) => [rowStyle, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.mutedLabel}>未設定にする</Text>
        </Pressable>
      )}
      {(createLabel !== undefined || showClear) && matches.length > 0 && (
        <View style={styles.separator} />
      )}
    </>
  );

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
        onPress={openSheet}
        style={({ pressed }) => [
          styles.field,
          pressed && { opacity: 0.7 },
          error !== undefined && error !== '' ? { borderColor: palette.warning } : null,
        ]}
      >
        <Text style={valueKey !== null ? styles.value : styles.placeholder}>
          {valueKey !== null ? value : placeholder}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {error !== undefined && error !== '' ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onShow={() => searchRef.current?.focus()}
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={overlay}
        >
          <Pressable style={backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{modalTitle}</Text>
            <TextField
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              placeholder="検索 / 新しいブランド名を入力"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submitQuery}
              containerStyle={searchWrap}
              testID={testID !== undefined ? `${testID}:search` : undefined}
            />
            <FlatList
              style={list}
              data={matches}
              keyExtractor={(item) => item}
              renderItem={renderRow}
              ListHeaderComponent={header}
              ListEmptyComponent={
                createLabel === undefined ? (
                  <Text style={styles.empty}>
                    登録済みのブランドはまだありません。名前を入力すると追加できます。
                  </Text>
                ) : null
              }
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              keyboardShouldPersistTaps="handled"
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const wrapper: ViewStyle = {
  marginBottom: space.md,
};

const overlay: ViewStyle = {
  flex: 1,
  justifyContent: 'flex-end',
};

const backdrop: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.35)',
};

const searchWrap: ViewStyle = {
  marginHorizontal: space.lg,
  marginBottom: space.sm,
};

const list: ViewStyle = {
  flex: 1,
};

const rowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
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
    height: '75%' as const,
  } satisfies ViewStyle,
  sheetTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: p.text,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  } as const,
  rowLabel: {
    flex: 1,
    fontSize: font.size.md,
    color: p.text,
  } as const,
  createLabel: {
    flex: 1,
    fontSize: font.size.md,
    color: p.text,
    fontWeight: font.weight.semibold,
  } as const,
  mutedLabel: {
    flex: 1,
    fontSize: font.size.md,
    color: p.textMuted,
  } as const,
  checkMark: {
    fontSize: font.size.md,
    color: p.text,
  } as const,
  empty: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: font.size.sm,
    color: p.textMuted,
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
