import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { colors, font, space } from '../theme';

export type RankingListItem = {
  /** Stable React key. */
  id: string;
  /** Primary line. */
  label: string;
  /** Optional secondary line. */
  sublabel?: string;
  /** Optional right-aligned trailing value (e.g. "12回", "¥1,200"). */
  trailing?: string;
  /** Optional press handler — when set the row is pressable. */
  onPress?: () => void;
};

type Props = {
  items: readonly RankingListItem[];
  /** Empty placeholder text. */
  emptyMessage?: string;
};

export const RankingList = ({ items, emptyMessage = 'データがありません' }: Props) => {
  if (items.length === 0) {
    return <Text style={emptyStyle}>{emptyMessage}</Text>;
  }
  return (
    <View>
      {items.map((it, idx) => {
        const content = (
          <View style={row}>
            <Text style={rankIdx}>{idx + 1}</Text>
            <View style={textCol}>
              <Text style={labelStyle} numberOfLines={1}>
                {it.label}
              </Text>
              {it.sublabel !== undefined && it.sublabel !== '' && (
                <Text style={sublabelStyle} numberOfLines={1}>
                  {it.sublabel}
                </Text>
              )}
            </View>
            {it.trailing !== undefined && it.trailing !== '' && (
              <Text style={trailingStyle}>{it.trailing}</Text>
            )}
          </View>
        );
        if (it.onPress) {
          return (
            <Pressable
              key={it.id}
              accessibilityRole="button"
              onPress={it.onPress}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              {content}
            </Pressable>
          );
        }
        return <View key={it.id}>{content}</View>;
      })}
    </View>
  );
};

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: space.sm,
  gap: space.md,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
};

const rankIdx = {
  width: 24,
  fontSize: font.size.md,
  fontWeight: font.weight.bold,
  color: colors.textMuted,
} as const;

const textCol: ViewStyle = {
  flex: 1,
  gap: 2,
};

const labelStyle = {
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.medium,
} as const;

const sublabelStyle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const trailingStyle = {
  fontSize: font.size.sm,
  fontWeight: font.weight.bold,
  color: colors.text,
} as const;

const emptyStyle = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;
