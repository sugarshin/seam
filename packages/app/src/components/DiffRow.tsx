import { Text, View, type ViewStyle } from 'react-native';
import {
  MEASUREMENT_KEY_LABEL,
  type MeasurementDiffSeverity,
  type MeasurementKey,
} from '@seam/shared';
import { colors, font, space } from '../theme';
import { SeverityBadge } from './SeverityBadge';

type Props = {
  measurementKey: MeasurementKey;
  candidateValue: number;
  referenceValue: number;
  unit: string;
  diffCm: number;
  severity: MeasurementDiffSeverity;
  comparable: boolean;
};

const fmt = (n: number, digits = 1): string => {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(digits);
};

const fmtDiff = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  if (rounded === 0) return '±0';
  if (rounded > 0) return `+${fmt(rounded)}`;
  return fmt(rounded);
};

export const DiffRow = ({
  measurementKey,
  candidateValue,
  referenceValue,
  unit,
  diffCm,
  severity,
  comparable,
}: Props) => {
  return (
    <View style={row}>
      <View style={labelCol}>
        <Text style={labelStyle}>{MEASUREMENT_KEY_LABEL[measurementKey]}</Text>
      </View>
      <View style={valuesCol}>
        <Text style={valuesText}>
          <Text style={valueEmphasized}>{fmt(candidateValue)}</Text>
          <Text style={valueDim}>{` ${unit}`}</Text>
          <Text style={valueDim}>{' / '}</Text>
          <Text style={valueDim}>{fmt(referenceValue)}</Text>
          <Text style={valueDim}>{` ${unit}`}</Text>
        </Text>
        {comparable ? (
          <Text style={diffText}>{fmtDiff(diffCm)} cm</Text>
        ) : (
          <Text style={diffText}>—</Text>
        )}
      </View>
      <View style={badgeCol}>
        {comparable ? (
          <SeverityBadge severity={severity} />
        ) : (
          <Text style={incompText}>単位違い</Text>
        )}
      </View>
    </View>
  );
};

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: space.sm,
  gap: space.sm,
};

const labelCol: ViewStyle = {
  width: 80,
};

const valuesCol: ViewStyle = {
  flex: 1,
};

const badgeCol: ViewStyle = {
  alignItems: 'flex-end',
  minWidth: 64,
};

const labelStyle = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;

const valuesText = {
  fontSize: font.size.md,
  color: colors.text,
} as const;

const valueEmphasized = {
  fontWeight: font.weight.semibold,
} as const;

const valueDim = {
  color: colors.textMuted,
} as const;

const diffText = {
  marginTop: 2,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const incompText = {
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;
