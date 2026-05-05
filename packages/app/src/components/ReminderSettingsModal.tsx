import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { ALL_LEAD_TIMES, leadTimeLabel, type ReminderLeadTime } from '../notifications';
import { Button } from './Button';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';
import { testIds } from '../utils/testIds';

export type ReminderSettingsResult = {
  enabled: boolean;
  leadTimes: readonly ReminderLeadTime[];
};

type Props = {
  visible: boolean;
  /** ISO timestamp of the auction end (for context message). */
  auctionEndsAt: string | undefined;
  initial: ReminderSettingsResult;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (result: ReminderSettingsResult) => void;
};

const formatEnd = (iso: string | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

export const ReminderSettingsModal = ({
  visible,
  auctionEndsAt,
  initial,
  submitting,
  onCancel,
  onSubmit,
}: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [selected, setSelected] = useState<Set<ReminderLeadTime>>(() => new Set(initial.leadTimes));

  useEffect(() => {
    if (visible) {
      setEnabled(initial.enabled);
      setSelected(new Set(initial.leadTimes));
    }
  }, [visible, initial.enabled, initial.leadTimes]);

  const toggle = (lt: ReminderLeadTime): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lt)) next.delete(lt);
      else next.add(lt);
      return next;
    });
  };

  const result = useMemo<ReminderSettingsResult>(
    () => ({
      enabled,
      leadTimes: ALL_LEAD_TIMES.filter((lt) => selected.has(lt)),
    }),
    [enabled, selected],
  );

  const canSubmit = !enabled || result.leadTimes.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={overlay}
      >
        <Pressable style={backdrop} onPress={onCancel} accessibilityLabel="閉じる" />
        <View
          style={[card, { backgroundColor: palette.bg }]}
          accessibilityViewIsModal
          testID={testIds.modal.reminderSettings}
        >
          <Text style={styles.title}>終了通知設定</Text>
          <Text style={styles.muted}>終了日時: {formatEnd(auctionEndsAt)}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>通知を有効にする</Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              accessibilityLabel="通知を有効にする"
            />
          </View>

          <Text style={[styles.muted, { marginTop: space.md }]}>
            終了の何分前に通知を受け取りますか？
          </Text>
          <View style={chipWrap}>
            {ALL_LEAD_TIMES.map((lt) => {
              const isOn = selected.has(lt);
              return (
                <Pressable
                  key={lt}
                  onPress={() => toggle(lt)}
                  disabled={!enabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn, disabled: !enabled }}
                  accessibilityLabel={`${leadTimeLabel(lt)} ${isOn ? '選択中' : '未選択'}`}
                  style={({ pressed }) => [
                    chipBase,
                    isOn ? styles.chipOn : styles.chipOff,
                    !enabled && { opacity: 0.4 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[chipLabel, { color: isOn ? palette.textInverse : palette.text }]}>
                    {leadTimeLabel(lt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={actions}>
            <Button
              label="キャンセル"
              variant="ghost"
              onPress={onCancel}
              testID={testIds.modalCancel(testIds.modal.reminderSettings)}
            />
            <Button
              label="保存"
              onPress={() => onSubmit(result)}
              loading={submitting}
              disabled={!canSubmit}
              testID={testIds.modalSubmit(testIds.modal.reminderSettings)}
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
  gap: space.sm,
};

const chipWrap: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.sm,
  marginTop: space.sm,
};

const chipBase: ViewStyle = {
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderRadius: radii.md,
  borderWidth: 1,
  minHeight: 36,
  alignItems: 'center',
  justifyContent: 'center',
};

const chipLabel = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
} as const;

const actions: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: space.sm,
  marginTop: space.lg,
};

const makeStyles = (p: ColorPalette) => ({
  title: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: p.text,
    marginBottom: space.xs,
  } as const,
  muted: {
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: p.border,
    marginTop: space.md,
  } satisfies ViewStyle,
  rowLabel: {
    fontSize: font.size.md,
    color: p.text,
    fontWeight: font.weight.semibold,
  } as const,
  chipOn: {
    backgroundColor: p.bgInverse,
    borderColor: p.bgInverse,
  } satisfies ViewStyle,
  chipOff: {
    backgroundColor: p.surface,
    borderColor: p.border,
  } satisfies ViewStyle,
});
