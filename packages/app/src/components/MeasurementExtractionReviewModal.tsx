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
import { colors, font, radii, space } from '../theme';

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

const CONFIDENCE_TONE: Record<MeasurementExtractionResult['confidence'], string> = {
  high: colors.same,
  medium: colors.different,
  low: colors.warning,
};

export const MeasurementExtractionReviewModal = ({
  visible,
  category,
  initialText,
  submitting,
  onCancel,
  onAdopt,
}: Props) => {
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
        <View style={card}>
          <Text style={title}>説明文から実寸を抽出</Text>
          <ScrollView style={scrollArea} keyboardShouldPersistTaps="handled">
            <TextField
              label="説明文"
              multiline
              value={text}
              onChangeText={setText}
              placeholder="商品説明（実寸が含まれるテキスト）を貼り付け"
              hint="改行・全角・略号 (W32inch 等) も自動で吸収します。"
            />
            <Button label="抽出する" onPress={onExtract} variant="secondary" />

            {result && (
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <View style={summaryRow}>
                  <Text style={summaryLabel}>信頼度</Text>
                  <View
                    style={[confidenceBadge, { borderColor: CONFIDENCE_TONE[result.confidence] }]}
                  >
                    <Text
                      style={[confidenceBadgeText, { color: CONFIDENCE_TONE[result.confidence] }]}
                    >
                      {CONFIDENCE_LABEL[result.confidence]}
                    </Text>
                  </View>
                </View>

                {result.measurements.length === 0 ? (
                  <Text style={muted}>抽出できる実寸が見つかりませんでした。</Text>
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
                          style={({ pressed }) => [measurementRow, pressed && { opacity: 0.6 }]}
                        >
                          <View style={[checkbox, checked && checkboxChecked]}>
                            {checked && <Text style={checkmark}>✓</Text>}
                          </View>
                          <Text style={mKey}>{MEASUREMENT_KEY_LABEL[m.key]}</Text>
                          <Text style={mValue}>
                            {m.value} {m.unit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {result.unmatchedKeys.length > 0 && (
                  <View style={{ marginTop: space.sm }}>
                    <Text style={muted}>
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
            <Button label="キャンセル" variant="ghost" onPress={onCancel} />
            <Button
              label={`採用 (${adopted.length})`}
              onPress={() => onAdopt(adopted)}
              loading={submitting}
              disabled={adopted.length === 0}
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
  backgroundColor: colors.bg,
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
  color: colors.text,
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

const summaryLabel = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;

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

const measurementRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  backgroundColor: colors.surface,
};

const checkbox: ViewStyle = {
  width: 22,
  height: 22,
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: radii.sm,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.bg,
};

const checkboxChecked: ViewStyle = {
  backgroundColor: colors.bgInverse,
  borderColor: colors.bgInverse,
};

const checkmark = {
  color: colors.textInverse,
  fontSize: font.size.sm,
  fontWeight: font.weight.bold,
} as const;

const mKey = {
  flex: 1,
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.semibold,
} as const;

const mValue = {
  fontSize: font.size.sm,
  color: colors.text,
} as const;

const muted = {
  color: colors.textMuted,
  fontSize: font.size.sm,
} as const;
