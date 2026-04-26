import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, font, radii, space } from '../theme';

export type WearLogDraft = {
  wornAt: string;
  notes?: string;
};

type Props = {
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (draft: WearLogDraft) => void;
};

const todayIsoDate = (): string => {
  const d = new Date();
  // YYYY-MM-DD without timezone surprises
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isValidDate = (s: string): boolean => {
  if (s.trim() === '') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
};

export const WearLogModal = ({ visible, submitting, onCancel, onSubmit }: Props) => {
  const [wornAt, setWornAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setWornAt(todayIsoDate());
      setNotes('');
    }
  }, [visible]);

  const dateValid = isValidDate(wornAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={overlay}
      >
        <Pressable style={backdrop} onPress={onCancel} />
        <View style={card}>
          <Text style={title}>着用記録</Text>
          <TextField
            label="着用日"
            placeholder="2026-04-26"
            value={wornAt}
            onChangeText={setWornAt}
            autoCapitalize="none"
            error={dateValid ? undefined : '日付の形式が不正です'}
            hint="例: 2026-04-26"
          />
          <TextField
            label="メモ（任意）"
            multiline
            placeholder="シーン・コーデ・天気など"
            value={notes}
            onChangeText={setNotes}
          />
          <View style={actions}>
            <Button label="キャンセル" variant="ghost" onPress={onCancel} />
            <Button
              label="記録する"
              onPress={() => {
                const trimmedNotes = notes.trim();
                onSubmit({
                  wornAt: new Date(wornAt).toISOString(),
                  notes: trimmedNotes === '' ? undefined : trimmedNotes,
                });
              }}
              disabled={!dateValid}
              loading={submitting}
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
  gap: space.sm,
};

const title = {
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  color: colors.text,
  marginBottom: space.sm,
} as const;

const actions: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: space.sm,
  marginTop: space.md,
};
