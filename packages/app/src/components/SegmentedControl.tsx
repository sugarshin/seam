import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radii, space } from '../theme';

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
}: Props<T>) => {
  return (
    <View style={[wrapper, style]} accessibilityRole="tablist">
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
            onPress={() => {
              if (!selected) onChange(opt.value);
            }}
            style={({ pressed }) => [
              segment,
              selected ? segmentSelected : segmentUnselected,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[label, { color: selected ? colors.textInverse : colors.textMuted }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            {opt.badge !== undefined && opt.badge !== '' && (
              <Text
                style={[badge, { color: selected ? colors.textInverse : colors.textMuted }]}
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

const wrapper: ViewStyle = {
  flexDirection: 'row',
  backgroundColor: colors.surface,
  borderRadius: radii.lg,
  padding: 2,
  gap: 2,
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

const segmentSelected: ViewStyle = {
  backgroundColor: colors.bgInverse,
};

const segmentUnselected: ViewStyle = {
  backgroundColor: 'transparent',
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
