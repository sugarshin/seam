import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { MEASUREMENT_KEY_LABEL, type GarmentCategory, type MeasurementKey } from '@seam/shared';
import {
  extractMeasurementsFromText,
  type ExtractedMeasurement,
  type MeasurementExtractionResult,
} from '@seam/domain';
import { Button } from './Button';
import { TextField } from './TextField';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';
import { testIds } from '../utils/testIds';

type Props = {
  visible: boolean;
  category: GarmentCategory;
  initialText: string;
  submitting?: boolean;
  onCancel: () => void;
  onAdopt: (adopted: ExtractedMeasurement[]) => void;
};

const CONFIDENCE_LABEL: Record<MeasurementExtractionResult['confidence'], string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const confidenceTone = (c: MeasurementExtractionResult['confidence'], p: ColorPalette): string => {
  switch (c) {
    case 'high':
      return p.same;
    case 'medium':
      return p.different;
    case 'low':
      return p.warning;
  }
};

export const MeasurementExtractionReviewModal = ({
  visible,
  category,
  initialText,
  submitting,
  onCancel,
  onAdopt,
}: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<MeasurementExtractionResult | null>(null);
  const [adoptKeys, setAdoptKeys] = useState<Set<MeasurementKey>>(new Set());

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setResult(null);
      setAdoptKeys(new Set());
    }
  }, [visible, initialText]);

  const onExtract = (): void => {
    const r = extractMeasurementsFromText(text, category);
    setResult(r);
    // default-adopt every successfully extracted row
    setAdoptKeys(new Set(r.measurements.map((m) => m.key)));
  };

  const adopted = useMemo<ExtractedMeasurement[]>(() => {
    if (!result) return [];
    return result.measurements.filter((m) => adoptKeys.has(m.key));
  }, [result, adoptKeys]);

  const toggleAdopt = (key: MeasurementKey): void => {
    setAdoptKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={overlay}
      >
        <Pressable style={backdrop} onPress={onCancel} />
        <View
          style={[card, { backgroundColor: palette.bg }]}
          testID={testIds.modal.measurementExtract}
        >
          <Text style={[title, { color: palette.text }]}>説明文から実寸を抽出</Text>
          <ScrollView style={scrollArea} keyboardShouldPersistTaps="handled">
            <TextField
              label="説明文"
              multiline
              value={text}
              onChangeText={setText}
              placeholder="商品説明（実寸が含まれるテキスト）を貼り付け"
              hint="改行・全角・略号 (W32inch 等) も自動で吸収します。"
              testID={testIds.modalField(testIds.modal.measurementExtract, 'text')}
            />
            <Button
              label="抽出する"
              onPress={onExtract}
              variant="secondary"
              testID={`${testIds.modal.measurementExtract}:extract`}
            />

            {result && (
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <View style={summaryRow}>
                  <Text style={styles.muted}>信頼度</Text>
                  <View
                    style={[
                      confidenceBadge,
                      { borderColor: confidenceTone(result.confidence, palette) },
                    ]}
                  >
                    <Text
                      style={[
                        confidenceBadgeText,
                        { color: confidenceTone(result.confidence, palette) },
                      ]}
                    >
                      {CONFIDENCE_LABEL[result.confidence]}
                    </Text>
                  </View>
                </View>

                {result.measurements.length === 0 ? (
                  <Text style={styles.muted}>抽出できる実寸が見つかりませんでした。</Text>
                ) : (
                  <View style={{ gap: space.xs }}>
                    {result.measurements.map((m) => {
                      const checked = adoptKeys.has(m.key);
                      return (
                        <Pressable
                          key={m.key}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked }}
                          onPress={() => toggleAdopt(m.key)}
                          style={({ pressed }) => [
                            styles.measurementRow,
                            pressed && { opacity: 0.6 },
                          ]}
                        >
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.mKey}>{MEASUREMENT_KEY_LABEL[m.key]}</Text>
                          <Text style={styles.mValue}>
                            {m.value} {m.unit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {result.unmatchedKeys.length > 0 && (
                  <View style={{ marginTop: space.sm }}>
                    <Text style={styles.muted}>
                      範囲外として除外:{' '}
                      {result.unmatchedKeys
                        .map((k) => MEASUREMENT_KEY_LABEL[k as MeasurementKey] ?? k)
                        .join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={actions}>
            <Button
              label="キャンセル"
              variant="ghost"
              onPress={onCancel}
              testID={testIds.modalCancel(testIds.modal.measurementExtract)}
            />
            <Button
              label={`採用 (${adopted.length})`}
              onPress={() => onAdopt(adopted)}
              loading={submitting}
              disabled={adopted.length === 0}
              testID={testIds.modalSubmit(testIds.modal.measurementExtract)}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
  backgroundColor: 'rgba(0,0,0,0.4)',
};

const card: ViewStyle = {
  borderTopLeftRadius: radii.lg,
  borderTopRightRadius: radii.lg,
  padding: space.lg,
  maxHeight: '85%',
};

const scrollArea: ViewStyle = {
  flexGrow: 0,
};

const title = {
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  marginBottom: space.md,
} as const;

const actions: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: space.sm,
  marginTop: space.md,
};

const summaryRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
};

const confidenceBadge: ViewStyle = {
  paddingHorizontal: space.sm,
  paddingVertical: 2,
  borderRadius: radii.sm,
  borderWidth: 1,
};

const confidenceBadgeText = {
  fontSize: font.size.xs,
  fontWeight: font.weight.bold,
  letterSpacing: 0.5,
} as const;

const makeStyles = (p: ColorPalette) => ({
  measurementRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
    backgroundColor: p.surface,
  } satisfies ViewStyle,
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: p.border,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: p.bg,
  } satisfies ViewStyle,
  checkboxChecked: {
    backgroundColor: p.bgInverse,
    borderColor: p.bgInverse,
  } satisfies ViewStyle,
  checkmark: {
    color: p.textInverse,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  } as const,
  mKey: {
    flex: 1,
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.semibold,
  } as const,
  mValue: {
    fontSize: font.size.sm,
    color: p.text,
  } as const,
  muted: {
    color: p.textMuted,
    fontSize: font.size.sm,
  } as const,
});
