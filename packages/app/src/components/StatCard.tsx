import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font, radii, space, useThemeColors } from '../theme';

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
  /** testID forwarded to the Pressable when `onPress` is provided. */
  testID?: string;
};

export const StatCard = ({
  title,
  value,
  subtext,
  tone = 'default',
  onPress,
  style,
  testID,
}: Props) => {
  const palette = useThemeColors();
  const accent =
    tone === 'warning' ? palette.warning : tone === 'good' ? palette.same : palette.text;
  const cardStyle: ViewStyle = {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: space.md,
    backgroundColor: palette.bg,
    gap: space.xs,
  };
  const inner = (
    <>
      <View style={titleRow}>
        <Text style={[titleStyle, { color: tone === 'default' ? palette.textMuted : accent }]}>
          {title}
        </Text>
        {onPress && <Text style={[chevron, { color: palette.textMuted }]}>›</Text>}
      </View>
      <Text style={[valueStyle, { color: palette.text }]}>{value}</Text>
      {subtext !== undefined && subtext !== '' && (
        <Text style={[subtextStyle, { color: palette.textMuted }]}>{subtext}</Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${value}`}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          { borderColor: tone === 'default' ? palette.border : accent },
          pressed && { opacity: 0.7 },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyle, { borderColor: tone === 'default' ? palette.border : accent }, style]}>
      {inner}
    </View>
  );
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
  fontWeight: font.weight.bold,
} as const;

const valueStyle = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
} as const;

const subtextStyle = {
  fontSize: font.size.xs,
} as const;
