import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { FAILURE_REASON_LABEL, type FailureLog } from '@seam/shared';
import { colors, font, radii, space } from '../theme';

type Props = {
  log: FailureLog;
  onDelete?: (id: string) => void;
};

const RESULT_LABEL: Record<FailureLog['result'], string> = {
  success: '成功',
  mixed: '一部成功',
  failure: '失敗',
};

const RESULT_TONE: Record<FailureLog['result'], string> = {
  success: colors.same,
  mixed: colors.different,
  failure: colors.warning,
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
};

export const FailureLogEntry = ({ log, onDelete }: Props) => {
  return (
    <View style={row}>
      <View style={[badge, { borderColor: RESULT_TONE[log.result] }]}>
        <Text style={[badgeText, { color: RESULT_TONE[log.result] }]}>
          {RESULT_LABEL[log.result]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={reasonStyle}>{FAILURE_REASON_LABEL[log.reason]}</Text>
        <Text style={dateStyle}>{formatDate(log.createdAt)}</Text>
        {log.notes && <Text style={notesStyle}>{log.notes}</Text>}
      </View>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onDelete(log.id)}
          hitSlop={8}
          style={({ pressed }) => [deleteBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={deleteLabel}>削除</Text>
        </Pressable>
      )}
    </View>
  );
};

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  paddingVertical: space.sm,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  gap: space.sm,
};

const badge: ViewStyle = {
  paddingHorizontal: space.sm,
  paddingVertical: 2,
  borderRadius: radii.sm,
  borderWidth: 1,
  alignSelf: 'flex-start',
  minWidth: 56,
  alignItems: 'center',
};

const badgeText = {
  fontSize: font.size.xs,
  fontWeight: font.weight.bold,
  letterSpacing: 0.5,
} as const;

const reasonStyle = {
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.medium,
} as const;

const dateStyle = {
  marginTop: 2,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const notesStyle = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.text,
} as const;

const deleteBtn: ViewStyle = {
  paddingHorizontal: space.sm,
  paddingVertical: space.xs,
  borderRadius: radii.sm,
};

const deleteLabel = {
  fontSize: font.size.xs,
  color: colors.warning,
  fontWeight: font.weight.semibold,
} as const;
