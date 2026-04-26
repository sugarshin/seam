import { Pressable, Text, View, type ViewStyle } from 'react-native';
import type { WearLog } from '@seam/shared';
import { colors, font, radii, space } from '../theme';

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
  return (
    <View style={row}>
      <View style={{ flex: 1 }}>
        <Text style={dateStyle}>{formatDate(log.wornAt)}</Text>
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

const dateStyle = {
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.medium,
} as const;

const notesStyle = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.textMuted,
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
