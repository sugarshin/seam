import { Pressable, Text, View, type ViewStyle } from 'react-native';
import type { BrandChecklistState, BrandGuide } from '@seam/shared';
import { hashChecklistText } from '../utils/hash';
import { colors, font, radii, space } from '../theme';

type Props = {
  guide: BrandGuide;
  itemId: string;
  states: BrandChecklistState[];
  onToggle: (checklistItemKey: string, isChecked: boolean) => void;
};

export const BrandChecklist = ({ guide, states, onToggle }: Props) => {
  const stateByKey = new Map<string, BrandChecklistState>();
  for (const s of states) stateByKey.set(s.checklistItemKey, s);

  if (guide.checklistItems.length === 0) {
    return (
      <View style={emptyWrap}>
        <Text style={muted}>このガイドにはチェック項目がありません。</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space.xs }}>
      {guide.checklistItems.map((text) => {
        const key = hashChecklistText(text);
        const isChecked = stateByKey.get(key)?.isChecked ?? false;
        return (
          <Pressable
            key={key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
            onPress={() => onToggle(key, !isChecked)}
            style={({ pressed }) => [row, pressed && { opacity: 0.6 }]}
          >
            <View style={[checkbox, isChecked && checkboxChecked]}>
              {isChecked && <Text style={checkmark}>✓</Text>}
            </View>
            <Text style={[label, isChecked && labelChecked]}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: space.sm,
  paddingVertical: space.xs,
};

const checkbox: ViewStyle = {
  width: 22,
  height: 22,
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: radii.sm,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 1,
  backgroundColor: colors.bg,
};

const checkboxChecked: ViewStyle = {
  backgroundColor: colors.bgInverse,
  borderColor: colors.bgInverse,
};

const checkmark = {
  color: colors.textInverse,
  fontSize: font.size.sm,
  fontWeight: font.weight.bold,
} as const;

const label = {
  flex: 1,
  fontSize: font.size.sm,
  color: colors.text,
  lineHeight: 20,
} as const;

const labelChecked = {
  color: colors.textMuted,
  textDecorationLine: 'line-through' as const,
};

const emptyWrap: ViewStyle = {
  paddingVertical: space.sm,
};

const muted = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;
