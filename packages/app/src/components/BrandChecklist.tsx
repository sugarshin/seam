import { Pressable, Text, View, type ViewStyle } from 'react-native';
import type { BrandChecklistState, BrandGuide } from '@seam/shared';
import { hashChecklistText } from '../utils/hash';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  guide: BrandGuide;
  itemId: string;
  states: BrandChecklistState[];
  onToggle: (checklistItemKey: string, isChecked: boolean) => void;
};

export const BrandChecklist = ({ guide, states, onToggle }: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const stateByKey = new Map<string, BrandChecklistState>();
  for (const s of states) stateByKey.set(s.checklistItemKey, s);

  if (guide.checklistItems.length === 0) {
    return (
      <View style={emptyWrap}>
        <Text style={styles.muted}>このガイドにはチェック項目がありません。</Text>
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
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.label, isChecked && styles.labelChecked]}>{text}</Text>
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

const emptyWrap: ViewStyle = {
  paddingVertical: space.sm,
};

const makeStyles = (p: ColorPalette) => ({
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: p.border,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
    backgroundColor: p.bg,
  } satisfies ViewStyle,
  checkboxChecked: {
    backgroundColor: p.bgInverse,
    borderColor: p.bgInverse,
  } satisfies ViewStyle,
  checkmark: {
    color: p.textInverse,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  } as const,
  label: {
    flex: 1,
    fontSize: font.size.sm,
    color: p.text,
    lineHeight: 20,
  } as const,
  labelChecked: {
    color: p.textMuted,
    textDecorationLine: 'line-through' as const,
  } as const,
  muted: {
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
});
