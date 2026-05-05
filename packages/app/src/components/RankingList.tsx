import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { type ColorPalette, font, space, useThemeColors } from '../theme';

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
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }
  return (
    <View>
      {items.map((it, idx) => {
        const content = (
          <View style={styles.row}>
            <Text style={styles.rankIdx}>{idx + 1}</Text>
            <View style={textCol}>
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
              </Text>
              {it.sublabel !== undefined && it.sublabel !== '' && (
                <Text style={styles.sublabel} numberOfLines={1}>
                  {it.sublabel}
                </Text>
              )}
            </View>
            {it.trailing !== undefined && it.trailing !== '' && (
              <Text style={styles.trailing}>{it.trailing}</Text>
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

const textCol: ViewStyle = {
  flex: 1,
  gap: 2,
};

const makeStyles = (p: ColorPalette) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: space.sm,
    gap: space.md,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  rankIdx: {
    width: 24,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: p.textMuted,
  } as const,
  label: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.medium,
  } as const,
  sublabel: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  trailing: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: p.text,
  } as const,
  empty: {
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
});
