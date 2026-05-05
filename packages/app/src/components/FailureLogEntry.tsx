import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { FAILURE_REASON_LABEL, type FailureLog } from '@seam/shared';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  log: FailureLog;
  onDelete?: (id: string) => void;
};

const RESULT_LABEL: Record<FailureLog['result'], string> = {
  success: '成功',
  mixed: '一部成功',
  failure: '失敗',
};

const resultTone = (result: FailureLog['result'], p: ColorPalette): string => {
  switch (result) {
    case 'success':
      return p.same;
    case 'mixed':
      return p.different;
    case 'failure':
      return p.warning;
  }
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
};

export const FailureLogEntry = ({ log, onDelete }: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const tone = resultTone(log.result, palette);
  return (
    <View style={styles.row}>
      <View style={[badge, { borderColor: tone }]}>
        <Text style={[badgeText, { color: tone }]}>{RESULT_LABEL[log.result]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.reason}>{FAILURE_REASON_LABEL[log.reason]}</Text>
        <Text style={styles.date}>{formatDate(log.createdAt)}</Text>
        {log.notes && <Text style={styles.notes}>{log.notes}</Text>}
      </View>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onDelete(log.id)}
          hitSlop={8}
          style={({ pressed }) => [deleteBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.deleteLabel}>削除</Text>
        </Pressable>
      )}
    </View>
  );
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

const deleteBtn: ViewStyle = {
  paddingHorizontal: space.sm,
  paddingVertical: space.xs,
  borderRadius: radii.sm,
};

const makeStyles = (p: ColorPalette) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: p.border,
    gap: space.sm,
  } satisfies ViewStyle,
  reason: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.medium,
  } as const,
  date: {
    marginTop: 2,
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  notes: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.text,
  } as const,
  deleteLabel: {
    fontSize: font.size.xs,
    color: p.warning,
    fontWeight: font.weight.semibold,
  } as const,
});
