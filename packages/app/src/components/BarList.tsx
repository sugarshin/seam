import { Text, View, type ViewStyle } from 'react-native';
import { colors, font, radii, space } from '../theme';

export type BarListItem = {
  label: string;
  value: number;
  /** Optional formatted value override (e.g. "¥12,300"). Defaults to value.toLocaleString(). */
  valueLabel?: string;
};

type Props = {
  items: readonly BarListItem[];
  /** When provided, normalizes against this value. Otherwise uses max(items.value). */
  maxOverride?: number;
  /** Empty placeholder text. */
  emptyMessage?: string;
};

const MIN_BAR_PCT = 2; // so even tiny values are visible

export const BarList = ({ items, maxOverride, emptyMessage = 'データがありません' }: Props) => {
  if (items.length === 0) {
    return <Text style={emptyStyle}>{emptyMessage}</Text>;
  }
  const max = Math.max(maxOverride ?? 0, ...items.map((i) => i.value), 1);
  return (
    <View style={list}>
      {items.map((it) => {
        const pct = Math.max(MIN_BAR_PCT, Math.round((it.value / max) * 100));
        const valueText = it.valueLabel ?? it.value.toLocaleString();
        return (
          <View key={it.label} style={row}>
            <View style={labelCol}>
              <Text style={labelStyle} numberOfLines={1}>
                {it.label}
              </Text>
            </View>
            <View style={barCol}>
              <View style={trackStyle}>
                <View style={[fillStyle, { width: `${pct}%` }]} />
              </View>
            </View>
            <View style={valueCol}>
              <Text style={valueStyle}>{valueText}</Text>
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

const labelStyle = {
  fontSize: font.size.xs,
  color: colors.text,
} as const;

const barCol: ViewStyle = {
  flex: 1,
};

const trackStyle: ViewStyle = {
  height: 10,
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  overflow: 'hidden',
};

const fillStyle: ViewStyle = {
  height: '100%',
  backgroundColor: colors.bgInverse,
};

const valueCol: ViewStyle = {
  minWidth: 56,
  alignItems: 'flex-end',
};

const valueStyle = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: colors.text,
} as const;

const emptyStyle = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;
