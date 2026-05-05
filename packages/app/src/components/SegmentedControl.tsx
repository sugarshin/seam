import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optional badge such as a count. Numbers are rendered as-is; falsy values hide the badge. */
  badge?: string | number;
};

type Props<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * testID for the control. Each segment gets `<testID>:<value>` derived.
   */
  testID?: string;
};

/**
 * Pill-style segmented control. Selected segment uses inverse tone, others muted.
 * 2+ options supported; sized to fill its container with equal-width segments.
 */
export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  style,
  testID,
}: Props<T>) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  return (
    <View style={[styles.wrapper, style]} accessibilityRole="tablist">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              opt.badge !== undefined && opt.badge !== ''
                ? `${opt.label} (${opt.badge})`
                : opt.label
            }
            testID={testID !== undefined ? `${testID}:${opt.value}` : undefined}
            onPress={() => {
              if (!selected) onChange(opt.value);
            }}
            style={({ pressed }) => [
              segment,
              selected ? styles.segmentSelected : styles.segmentUnselected,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[label, { color: selected ? palette.textInverse : palette.textMuted }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            {opt.badge !== undefined && opt.badge !== '' && (
              <Text
                style={[badge, { color: selected ? palette.textInverse : palette.textMuted }]}
                numberOfLines={1}
              >
                {opt.badge}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

const segment: ViewStyle = {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space.xs,
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderRadius: radii.md,
};

const label = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
} as const;

const badge = {
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  opacity: 0.85,
} as const;

const makeStyles = (p: ColorPalette) => ({
  wrapper: {
    flexDirection: 'row' as const,
    backgroundColor: p.surface,
    borderRadius: radii.lg,
    padding: 2,
    gap: 2,
  },
  segmentSelected: {
    backgroundColor: p.bgInverse,
  } satisfies ViewStyle,
  segmentUnselected: {
    backgroundColor: 'transparent',
  } satisfies ViewStyle,
});
