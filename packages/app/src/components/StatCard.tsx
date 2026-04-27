import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
  /** When provided, the card becomes pressable and shows a chevron affordance. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const StatCard = ({ title, value, subtext, tone = 'default', onPress, style }: Props) => {
  const accent = tone === 'warning' ? colors.warning : tone === 'good' ? colors.same : colors.text;
  const inner = (
    <>
      <View style={titleRow}>
        <Text style={[titleStyle, { color: tone === 'default' ? colors.textMuted : accent }]}>
          {title}
        </Text>
        {onPress && <Text style={chevron}>›</Text>}
      </View>
      <Text style={valueStyle}>{value}</Text>
      {subtext !== undefined && subtext !== '' && <Text style={subtextStyle}>{subtext}</Text>}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${value}`}
        onPress={onPress}
        style={({ pressed }) => [
          card,
          { borderColor: tone === 'default' ? colors.border : accent },
          pressed && { opacity: 0.7 },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[card, { borderColor: tone === 'default' ? colors.border : accent }, style]}>
      {inner}
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

const titleRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.xs,
};

const titleStyle = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
} as const;

const chevron = {
  fontSize: font.size.md,
  color: colors.textMuted,
  fontWeight: font.weight.bold,
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
