import { useMemo, useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { Chip } from './Chip';
import { TextField } from './TextField';
import { colors, font, space } from '../theme';

type Props = {
  label?: string;
  values: string[];
  suggestions?: readonly string[];
  onChange: (values: string[]) => void;
};

export const TagInput = ({ label, values, suggestions = [], onChange }: Props) => {
  const [draft, setDraft] = useState('');

  const normalizedValues = useMemo(() => values.map((v) => v.toLowerCase()), [values]);
  const filteredSuggestions = useMemo(() => {
    const seen = new Set(normalizedValues);
    const trimmed = draft.trim().toLowerCase();
    return suggestions.filter((s) => {
      const lower = s.toLowerCase();
      if (seen.has(lower)) return false;
      if (trimmed === '') return true;
      return lower.includes(trimmed);
    });
  }, [suggestions, normalizedValues, draft]);

  const addTag = (raw: string): void => {
    const trimmed = raw.trim();
    if (trimmed === '') return;
    if (normalizedValues.includes(trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  };

  const removeTag = (target: string): void => {
    onChange(values.filter((v) => v !== target));
  };

  return (
    <View style={{ marginBottom: space.md }}>
      {label !== undefined && <Text style={labelStyle}>{label}</Text>}
      {values.length > 0 && (
        <View style={chipRow}>
          {values.map((v) => (
            <Chip key={v} label={v} tone="default" onRemove={() => removeTag(v)} />
          ))}
        </View>
      )}
      <TextField
        value={draft}
        onChangeText={setDraft}
        placeholder="タグを入力して return"
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => addTag(draft)}
        blurOnSubmit={false}
      />
      {filteredSuggestions.length > 0 && (
        <View style={chipRow}>
          {filteredSuggestions.slice(0, 12).map((s) => (
            <Chip key={s} label={`+ ${s}`} tone="muted" onPress={() => addTag(s)} />
          ))}
        </View>
      )}
      {draft.trim() !== '' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => addTag(draft)}
          style={({ pressed }) => [addBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={addBtnLabel}>「{draft.trim()}」を追加</Text>
        </Pressable>
      )}
    </View>
  );
};

const labelStyle = {
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: colors.textMuted,
  marginBottom: space.xs,
} as const;

const chipRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.xs,
  marginBottom: space.sm,
};

const addBtn: ViewStyle = {
  paddingVertical: space.xs,
};

const addBtnLabel = {
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.medium,
} as const;
