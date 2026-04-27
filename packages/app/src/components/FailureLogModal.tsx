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
import { FAILURE_REASON_LABEL, type FailureLog, type FailureReason } from '@seam/shared';
import { Button } from './Button';
import { Picker, type PickerOption } from './Picker';
import { TextField } from './TextField';
import { colors, font, radii, space } from '../theme';

export type FailureLogDraft = {
  result: FailureLog['result'];
  reason: FailureReason;
  notes?: string;
};

type Props = {
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (draft: FailureLogDraft) => void;
};

const RESULT_OPTIONS: readonly PickerOption<FailureLog['result']>[] = [
  { value: 'success', label: '成功' },
  { value: 'mixed', label: '一部成功' },
  { value: 'failure', label: '失敗' },
];

const REASON_OPTIONS: readonly PickerOption<FailureReason>[] = (
  Object.entries(FAILURE_REASON_LABEL) as [FailureReason, string][]
).map(([value, label]) => ({ value, label }));

export const FailureLogModal = ({ visible, submitting, onCancel, onSubmit }: Props) => {
  const [result, setResult] = useState<FailureLog['result']>('failure');
  const [reason, setReason] = useState<FailureReason>('other');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setResult('failure');
      setReason('other');
      setNotes('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={overlay}
      >
        <Pressable style={backdrop} onPress={onCancel} />
        <View style={card}>
          <Text style={title}>結果を振り返る</Text>
          <Picker<FailureLog['result']>
            label="結果"
            value={result}
            options={RESULT_OPTIONS}
            onChange={setResult}
            modalTitle="結果"
            required
          />
          <Picker<FailureReason>
            label="主な理由"
            value={reason}
            options={REASON_OPTIONS}
            onChange={setReason}
            modalTitle="理由"
            required
          />
          <TextField
            label="メモ（任意）"
            multiline
            placeholder="次の購入で気をつけたい点など"
            value={notes}
            onChangeText={setNotes}
          />
          <View style={actions}>
            <Button label="キャンセル" variant="ghost" onPress={onCancel} />
            <Button
              label="記録する"
              onPress={() => {
                const trimmed = notes.trim();
                onSubmit({
                  result,
                  reason,
                  notes: trimmed === '' ? undefined : trimmed,
                });
              }}
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
