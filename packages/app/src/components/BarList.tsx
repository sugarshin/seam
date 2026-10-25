import { Text, View, type ViewStyle } from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

export type BarListItem = {
  label: string;
  value: number;
  /** Optional formatted value override (e.g. "¥12,300"). Defaults to value.toLocaleString(). */
  valueLabel?: string;
  /**
   * Optional color dot before the label (e.g. the garment color itself).
   * `null` renders a hollow dot for entries without a single color.
   */
  swatch?: string | null;
};

type Props = {
  items: readonly BarListItem[];
  /** When provided, normalizes against this value. Otherwise uses max(items.value). */
  maxOverride?: number;
  /** Empty placeholder text. */
  emptyMessage?: string;
};

const MIN_BAR_PCT = 2; // so even tiny (non-zero) values are visible

export const BarList = ({ items, maxOverride, emptyMessage = 'データがありません' }: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }
  const max = Math.max(maxOverride ?? 0, ...items.map((i) => i.value), 1);
  return (
    <View style={list}>
      {items.map((it) => {
        // Zero stays empty so a 0 bucket never reads as "a little".
        const pct = it.value <= 0 ? 0 : Math.max(MIN_BAR_PCT, Math.round((it.value / max) * 100));
        const valueText = it.valueLabel ?? it.value.toLocaleString();
        return (
          <View key={it.label} style={row}>
            <View style={[labelCol, swatchRow]}>
              {it.swatch !== undefined && (
                <View
                  style={[
                    styles.swatch,
                    it.swatch === null ? { borderStyle: 'dashed' } : { backgroundColor: it.swatch },
                  ]}
                />
              )}
              <Text style={[styles.label, { flexShrink: 1 }]} numberOfLines={1}>
                {it.label}
              </Text>
            </View>
            <View style={barCol}>
              <View style={styles.track}>
                {pct > 0 && <View style={[styles.fill, { width: `${pct}%` }]} />}
              </View>
            </View>
            <View style={valueCol}>
              <Text style={styles.value}>{valueText}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const list: ViewStyle = {
  gap: space.sm,
};

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
};

const labelCol: ViewStyle = {
  width: 96,
};

const swatchRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.xs,
};

const barCol: ViewStyle = {
  flex: 1,
};

const valueCol: ViewStyle = {
  minWidth: 56,
  alignItems: 'flex-end',
};

const makeStyles = (p: ColorPalette) => ({
  label: {
    fontSize: font.size.xs,
    color: p.text,
  } as const,
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: p.border,
  } satisfies ViewStyle,
  track: {
    height: 10,
    backgroundColor: p.surface,
    borderRadius: radii.sm,
    overflow: 'hidden' as const,
  } satisfies ViewStyle,
  fill: {
    height: '100%' as const,
    backgroundColor: p.bgInverse,
  } satisfies ViewStyle,
  value: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: p.text,
  } as const,
  empty: {
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
});
