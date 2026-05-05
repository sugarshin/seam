import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import {
  CATEGORY_LABEL,
  GARMENT_CATEGORIES,
  MEASUREMENT_KEY_LABEL,
  measurementKeysFor,
  type GarmentCategory,
  type MeasurementKey,
  type MeasurementRule,
} from '@seam/shared';
import { Button } from '../../src/components/Button';
import { Picker, type PickerOption } from '../../src/components/Picker';
import { TextField } from '../../src/components/TextField';
import { measurementRuleRepository } from '../../src/repositories';
import { type ColorPalette, font, radii, space, useThemeColors } from '../../src/theme';
import { testIds } from '../../src/utils/testIds';

type Operator = MeasurementRule['operator'];
type Severity = MeasurementRule['severity'];

const OPERATOR_OPTIONS: readonly PickerOption<Operator>[] = [
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
];

const SEVERITY_OPTIONS: readonly PickerOption<Severity>[] = [
  { value: 'warning', label: 'Warning' },
  { value: 'ng', label: 'NG' },
];

const CATEGORY_OPTIONS: readonly PickerOption<GarmentCategory>[] = GARMENT_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABEL[c],
}));

const opLabel = (op: Operator): string => OPERATOR_OPTIONS.find((o) => o.value === op)?.label ?? op;

const sevLabel = (s: Severity): string => SEVERITY_OPTIONS.find((o) => o.value === s)?.label ?? s;

export default function MeasurementRulesScreen() {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [rules, setRules] = useState<MeasurementRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState<GarmentCategory | undefined>(undefined);
  const [measurementKey, setMeasurementKey] = useState<MeasurementKey | undefined>(undefined);
  const [operator, setOperator] = useState<Operator | undefined>(undefined);
  const [valueStr, setValueStr] = useState('');
  const [severity, setSeverity] = useState<Severity | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await measurementRuleRepository.listAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const measurementKeyOptions = useMemo<readonly PickerOption<MeasurementKey>[]>(() => {
    if (!category) return [];
    return measurementKeysFor(category).map((k) => ({
      value: k,
      label: MEASUREMENT_KEY_LABEL[k],
    }));
  }, [category]);

  const reset = () => {
    setCategory(undefined);
    setMeasurementKey(undefined);
    setOperator(undefined);
    setValueStr('');
    setSeverity(undefined);
    setMessage('');
  };

  const onSubmit = useCallback(async () => {
    if (!category || !measurementKey || !operator || !severity) {
      Alert.alert('入力不足', 'すべての項目を入力してください。');
      return;
    }
    const value = Number(valueStr);
    if (!Number.isFinite(value)) {
      Alert.alert('入力エラー', '値は数値で入力してください。');
      return;
    }
    if (message.trim().length === 0) {
      Alert.alert('入力エラー', 'メッセージを入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      await measurementRuleRepository.create({
        category,
        measurementKey,
        operator,
        value,
        severity,
        message: message.trim(),
      });
      reset();
      await load();
    } catch (err) {
      Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [category, measurementKey, operator, valueStr, severity, message, load]);

  const onDelete = useCallback(
    (rule: MeasurementRule) => {
      Alert.alert(
        '削除しますか？',
        `${MEASUREMENT_KEY_LABEL[rule.measurementKey]} のルールを削除します。`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除する',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await measurementRuleRepository.delete(rule.id);
                  await load();
                } catch (err) {
                  Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
                }
              })();
            },
          },
        ],
      );
    },
    [load],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: '個人ルール', headerShown: true }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>新規追加</Text>
          <Picker<GarmentCategory>
            label="カテゴリ"
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={(v) => {
              setCategory(v);
              setMeasurementKey(undefined);
            }}
            modalTitle="カテゴリ"
            required
            testID={testIds.picker.ruleCategory}
          />
          <Picker<MeasurementKey>
            label="実寸キー"
            value={measurementKey}
            options={measurementKeyOptions}
            onChange={setMeasurementKey}
            modalTitle="実寸キー"
            required
            testID={testIds.picker.ruleMeasurementKey}
          />
          <Picker<Operator>
            label="演算子"
            value={operator}
            options={OPERATOR_OPTIONS}
            onChange={setOperator}
            modalTitle="演算子"
            required
            testID={testIds.picker.ruleOperator}
          />
          <TextField
            label="値 (cm or サイズ)"
            value={valueStr}
            onChangeText={setValueStr}
            keyboardType="decimal-pad"
            required
            testID={testIds.field.ruleValue}
          />
          <Picker<Severity>
            label="重要度"
            value={severity}
            options={SEVERITY_OPTIONS}
            onChange={setSeverity}
            modalTitle="重要度"
            required
            testID={testIds.picker.ruleSeverity}
          />
          <TextField
            label="メッセージ"
            value={message}
            onChangeText={setMessage}
            placeholder="例: 肩幅が狭すぎる"
            required
            testID={testIds.field.ruleMessage}
          />
          <Button
            label="ルールを追加"
            onPress={onSubmit}
            loading={submitting}
            testID={testIds.btn.addRule}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>登録済み</Text>
          {loading ? (
            <Text style={styles.muted}>読み込み中…</Text>
          ) : rules.length === 0 ? (
            <Text style={styles.muted}>まだルールがありません。</Text>
          ) : (
            rules.map((r) => (
              <View key={r.id} style={styles.ruleCard} testID={testIds.cardRule(r.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>
                    {CATEGORY_LABEL[r.category]} · {MEASUREMENT_KEY_LABEL[r.measurementKey]}
                  </Text>
                  <Text style={styles.ruleBody}>
                    {opLabel(r.operator)} {r.value} → {sevLabel(r.severity)}
                  </Text>
                  <Text style={styles.ruleMessage}>{r.message}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  testID={`${testIds.cardRule(r.id)}:delete`}
                  onPress={() => onDelete(r)}
                  style={({ pressed }) => [deleteBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.deleteLabel}>削除</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const deleteBtn: ViewStyle = {
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
};

const makeStyles = (p: ColorPalette) => ({
  section: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  sectionTitle: {
    fontSize: font.size.xs,
    color: p.textMuted,
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: space.md,
  } as const,
  muted: {
    color: p.textMuted,
    fontSize: font.size.sm,
  } as const,
  ruleCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
    marginBottom: space.sm,
    backgroundColor: p.surface,
  } satisfies ViewStyle,
  ruleTitle: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.semibold,
  } as const,
  ruleBody: {
    fontSize: font.size.sm,
    color: p.text,
    marginTop: 2,
  } as const,
  ruleMessage: {
    fontSize: font.size.xs,
    color: p.textMuted,
    marginTop: 2,
  } as const,
  deleteLabel: {
    fontSize: font.size.sm,
    color: p.warning,
    fontWeight: font.weight.semibold,
  } as const,
});
