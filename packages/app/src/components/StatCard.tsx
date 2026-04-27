import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radii, space } from '../theme';

type Props = {
  /** Section title displayed at the top in muted style. */
  title: string;
  /** Primary metric — rendered large and bold. */
  value: string | number;
  /** Optional subtext under the metric (e.g. "12 / 着てない 2"). */
  subtext?: string;
  /** Optional accent color applied to the title text and border. */
  tone?: 'default' | 'warning' | 'good';
  style?: StyleProp<ViewStyle>;
};

export const StatCard = ({ title, value, subtext, tone = 'default', style }: Props) => {
  const accent = tone === 'warning' ? colors.warning : tone === 'good' ? colors.same : colors.text;
  return (
    <View style={[card, { borderColor: tone === 'default' ? colors.border : accent }, style]}>
      <Text style={[titleStyle, { color: tone === 'default' ? colors.textMuted : accent }]}>
        {title}
      </Text>
      <Text style={valueStyle}>{value}</Text>
      {subtext !== undefined && subtext !== '' && <Text style={subtextStyle}>{subtext}</Text>}
    </View>
  );
};

const card: ViewStyle = {
  flexBasis: '47%',
  flexGrow: 1,
  borderWidth: 1,
  borderRadius: radii.md,
  padding: space.md,
  backgroundColor: colors.bg,
  gap: space.xs,
};

const titleStyle = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
} as const;

const valueStyle = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  color: colors.text,
} as const;

const subtextStyle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;
