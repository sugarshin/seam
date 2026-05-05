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
import type { ScoreDecision } from '@seam/shared';
import { Button } from './Button';
import { TextField } from './TextField';
import { font, radii, space, useThemeColors } from '../theme';
import { testIds } from '../utils/testIds';

type Props = {
  visible: boolean;
  decision: ScoreDecision | null;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

const DECISION_TITLE: Record<ScoreDecision, string> = {
  buy: 'Buy として記録',
  watch: 'Watch として記録',
  skip: 'Skip として記録',
};

const DECISION_HINT: Record<ScoreDecision, string> = {
  buy: 'なぜ買う判断をしたか（サイズ感・価格・好み等）',
  watch: 'なぜ様子見にしたか（価格待ち・サイズ要確認等）',
  skip: 'なぜ見送ったか（被り・サイズ NG・予算外等）',
};

export const DecisionReasonModal = ({
  visible,
  decision,
  submitting,
  onCancel,
  onSubmit,
}: Props) => {
  const palette = useThemeColors();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  if (!decision) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={overlay}
      >
        <Pressable style={backdrop} onPress={onCancel} />
        <View style={[card, { backgroundColor: palette.bg }]} testID={testIds.modal.decisionReason}>
          <Text style={[title, { color: palette.text }]}>{DECISION_TITLE[decision]}</Text>
          <TextField
            label="理由"
            multiline
            placeholder={DECISION_HINT[decision]}
            value={reason}
            onChangeText={setReason}
            hint="後から振り返れる短いメモを残しましょう。"
            testID={testIds.modalField(testIds.modal.decisionReason, 'reason')}
          />
          <View style={actions}>
            <Button
              label="キャンセル"
              variant="ghost"
              onPress={onCancel}
              testID={testIds.modalCancel(testIds.modal.decisionReason)}
            />
            <Button
              label="記録する"
              onPress={() => onSubmit(reason.trim())}
              disabled={reason.trim().length === 0}
              loading={submitting}
              testID={testIds.modalSubmit(testIds.modal.decisionReason)}
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

const title = {
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  marginBottom: space.sm,
} as const;

const actions: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: space.sm,
  marginTop: space.md,
};
