import { Pressable, Text, View, type ViewStyle } from 'react-native';
import type { WearLog } from '@seam/shared';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';
import { testIds } from '../utils/testIds';

type Props = {
  log: WearLog;
  onDelete?: (id: string) => void;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
};

export const WearLogEntry = ({ log, onDelete }: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  return (
    <View style={styles.row} testID={testIds.cardWearLog(log.id)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.date}>{formatDate(log.wornAt)}</Text>
        {log.notes && <Text style={styles.notes}>{log.notes}</Text>}
      </View>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          testID={`${testIds.cardWearLog(log.id)}:delete`}
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
  date: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.medium,
  } as const,
  notes: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  deleteLabel: {
    fontSize: font.size.xs,
    color: p.warning,
    fontWeight: font.weight.semibold,
  } as const,
});
