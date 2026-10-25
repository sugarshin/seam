import { Text, View, type ViewStyle } from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  rowLabels: readonly string[];
  colLabels: readonly string[];
  /** counts[rowIndex][colIndex] */
  counts: readonly (readonly number[])[];
  max: number;
  /** Optional color dot per row (same semantics as `BarListItem.swatch`). */
  rowSwatches?: readonly (string | null)[];
  emptyMessage?: string;
  testID?: string;
};

const MIN_OPACITY = 0.15;
/** Above this fill opacity the count switches to inverse ink for contrast. */
const INVERSE_TEXT_AT = 0.55;

/**
 * Count matrix shaded with a single-hue sequential ramp (inverse ink at
 * varying opacity). Zero cells stay on the surface color and print nothing.
 */
export const HeatmapGrid = ({
  rowLabels,
  colLabels,
  counts,
  max,
  rowSwatches,
  emptyMessage = 'データがありません',
  testID,
}: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  if (rowLabels.length === 0 || colLabels.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }
  return (
    <View testID={testID} style={{ gap: 2 }}>
      <View style={row}>
        <View style={labelCol} />
        {colLabels.map((c) => (
          <Text key={c} style={styles.colLabel} numberOfLines={1}>
            {c}
          </Text>
        ))}
      </View>
      {rowLabels.map((r, ri) => {
        const swatch = rowSwatches?.[ri];
        return (
          <View key={r} style={row}>
            <View style={[labelCol, swatchRow]}>
              {swatch !== undefined && (
                <View
                  style={[
                    styles.swatch,
                    swatch === null ? { borderStyle: 'dashed' } : { backgroundColor: swatch },
                  ]}
                />
              )}
              <Text style={[styles.rowLabel, { flexShrink: 1 }]} numberOfLines={1}>
                {r}
              </Text>
            </View>
            {colLabels.map((c, ci) => {
              const n = counts[ri]?.[ci] ?? 0;
              const opacity =
                n === 0 || max === 0 ? 0 : MIN_OPACITY + (1 - MIN_OPACITY) * (n / max);
              return (
                <View key={c} style={[cell, styles.cellBox]}>
                  {n > 0 && <View style={[styles.fill, { opacity }]} />}
                  {n > 0 && (
                    <Text
                      style={[
                        styles.count,
                        { color: opacity > INVERSE_TEXT_AT ? palette.textInverse : palette.text },
                      ]}
                    >
                      {n}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
};

const labelCol: ViewStyle = {
  width: 84,
};

const swatchRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.xs,
};

const cell: ViewStyle = {
  flex: 1,
};

const makeStyles = (p: ColorPalette) => ({
  colLabel: {
    flex: 1,
    fontSize: font.size.xs,
    color: p.textMuted,
    textAlign: 'center' as const,
  } as const,
  rowLabel: {
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
  cellBox: {
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: p.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  } satisfies ViewStyle,
  fill: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: p.bgInverse,
  } satisfies ViewStyle,
  count: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  } as const,
  empty: {
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
});
