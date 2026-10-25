import { Text, View, type ViewStyle } from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  /** Highlighted target window (e.g. the well-fitting range). */
  fit?: { min: number; max: number } | null;
  format: (value: number) => string;
  testID?: string;
};

const TRACK_HEIGHT = 20;

/**
 * Horizontal box plot: whisker = min..max, box = middle 50%, tick = median,
 * outlined window = `fit`. The scale spans this row's own values (plus the
 * fit window) with a little padding, so rows are not comparable to each
 * other — each row reads on its own with the printed min / max.
 */
export const RangeBar = ({ min, p25, median, p75, max, fit, format, testID }: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);

  const lo = Math.min(min, fit?.min ?? min);
  const hi = Math.max(max, fit?.max ?? max);
  const pad = hi === lo ? 1 : (hi - lo) * 0.08;
  const domainMin = lo - pad;
  const span = hi + pad - domainMin;
  const pct = (v: number): number => ((v - domainMin) / span) * 100;
  const widthPct = (a: number, b: number): number => Math.max(pct(b) - pct(a), 0);

  return (
    <View testID={testID} style={{ gap: 2 }}>
      <View style={{ height: TRACK_HEIGHT }}>
        <View style={[styles.whisker, { left: `${pct(min)}%`, width: `${widthPct(min, max)}%` }]} />
        <View
          style={[
            styles.box,
            { left: `${pct(p25)}%`, width: `${widthPct(p25, p75)}%`, minWidth: 2 },
          ]}
        />
        <View style={[styles.median, { left: `${pct(median)}%` }]} />
        {fit && (
          <View
            style={[
              styles.fit,
              { left: `${pct(fit.min)}%`, width: `${widthPct(fit.min, fit.max)}%`, minWidth: 6 },
            ]}
          />
        )}
      </View>
      <View style={endLabels}>
        <Text style={styles.endLabel}>{format(min)}</Text>
        <Text style={styles.endLabel}>{format(max)}</Text>
      </View>
    </View>
  );
};

/** Key for `RangeBar`'s marks. Render once above a list of bars. */
export const RangeBarLegend = ({ fitLabel }: { fitLabel: string }) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const item = (mark: React.ReactNode, label: string) => (
    <View style={legendItem}>
      {mark}
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
  return (
    <View style={legendRow}>
      {item(<View style={[styles.legendWhisker]} />, '最小〜最大')}
      {item(<View style={[styles.legendBox]} />, '中央 50%')}
      {item(<View style={[styles.legendMedian]} />, '中央値')}
      {item(<View style={[styles.legendFit]} />, fitLabel)}
    </View>
  );
};

const endLabels: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
};

const legendRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.md,
};

const legendItem: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.xs,
};

const makeStyles = (p: ColorPalette) => ({
  whisker: {
    position: 'absolute' as const,
    top: TRACK_HEIGHT / 2 - 1,
    height: 2,
    backgroundColor: p.textMuted,
    opacity: 0.5,
  } satisfies ViewStyle,
  box: {
    position: 'absolute' as const,
    top: 4,
    height: TRACK_HEIGHT - 8,
    backgroundColor: p.textMuted,
    opacity: 0.45,
    borderRadius: radii.sm,
  } satisfies ViewStyle,
  median: {
    position: 'absolute' as const,
    top: 2,
    width: 2,
    marginLeft: -1,
    height: TRACK_HEIGHT - 4,
    backgroundColor: p.text,
  } satisfies ViewStyle,
  fit: {
    position: 'absolute' as const,
    top: 0,
    height: TRACK_HEIGHT,
    borderWidth: 2,
    borderColor: p.same,
    borderRadius: radii.sm,
  } satisfies ViewStyle,
  endLabel: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  legendText: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  legendWhisker: {
    width: 14,
    height: 2,
    backgroundColor: p.textMuted,
    opacity: 0.5,
  } satisfies ViewStyle,
  legendBox: {
    width: 14,
    height: 10,
    backgroundColor: p.textMuted,
    opacity: 0.45,
    borderRadius: radii.sm,
  } satisfies ViewStyle,
  legendMedian: {
    width: 2,
    height: 12,
    backgroundColor: p.text,
  } satisfies ViewStyle,
  legendFit: {
    width: 14,
    height: 12,
    borderWidth: 2,
    borderColor: p.same,
    borderRadius: radii.sm,
  } satisfies ViewStyle,
});
