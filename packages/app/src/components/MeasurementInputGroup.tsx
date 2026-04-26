import { useEffect, useMemo, useState } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import {
  CATEGORY_LABEL,
  MEASUREMENT_KEY_LABEL,
  defaultUnitFor,
  measurementGroupOf,
  measurementKeysFor,
  type GarmentCategory,
  type MeasurementInput,
  type MeasurementKey,
  type MeasurementUnit,
} from '@seam/shared';
import { TextField } from './TextField';
import { colors, font, space } from '../theme';

type Props = {
  category: GarmentCategory;
  itemId: string;
  values: MeasurementInput[];
  onChange: (values: MeasurementInput[]) => void;
};

/** Allow optional one decimal-place number ("12", "12.", "12.5"). */
const DECIMAL_DRAFT_RE = /^(\d+)(\.\d?)?$/;

const formatPersisted = (value: number): string => {
  // Show trailing ".0" only if the source had a fractional part — but since we
  // round to 1 decimal place, just trim ".0" so "60" displays as "60", and "60.5"
  // displays as "60.5".
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const MeasurementInputGroup = ({ category, itemId, values, onChange }: Props) => {
  const keys = useMemo<readonly MeasurementKey[]>(() => measurementKeysFor(category), [category]);
  const group = measurementGroupOf(category);

  const valueByKey = useMemo(() => {
    const map = new Map<MeasurementKey, MeasurementInput>();
    for (const v of values) map.set(v.key, v);
    return map;
  }, [values]);

  // Per-key text drafts so users can type intermediate states like "12." without
  // round-tripping through Number() and losing the trailing dot.
  const [drafts, setDrafts] = useState<Partial<Record<MeasurementKey, string>>>({});

  // When the parent's persisted values change for reasons outside of this input
  // (initial load, form reset, etc.), seed the drafts with formatted versions.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Partial<Record<MeasurementKey, string>> = { ...prev };
      for (const key of keys) {
        if (next[key] !== undefined) continue;
        const persisted = valueByKey.get(key);
        if (persisted) next[key] = formatPersisted(persisted.value);
      }
      return next;
    });
  }, [keys, valueByKey]);

  if (group === 'none' || keys.length === 0) {
    return (
      <View style={emptyBox}>
        <Text style={emptyText}>{CATEGORY_LABEL[category]} は実寸入力なし</Text>
      </View>
    );
  }

  const commit = (key: MeasurementKey, draft: string): void => {
    const trimmed = draft.trim();
    const next = values.filter((v) => v.key !== key);

    if (trimmed === '' || trimmed === '.') {
      onChange(next);
      return;
    }

    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) {
      onChange(next);
      return;
    }

    const rounded = Math.round(num * 10) / 10;
    const existing = valueByKey.get(key);
    const unit: MeasurementUnit = existing?.unit ?? defaultUnitFor(key);
    next.push({ itemId, key, value: rounded, unit });
    onChange(next);
  };

  const handleChange = (key: MeasurementKey, raw: string): void => {
    // Keep the raw draft so the user sees what they typed.
    if (raw === '' || DECIMAL_DRAFT_RE.test(raw)) {
      setDrafts((prev) => ({ ...prev, [key]: raw }));
      commit(key, raw);
    }
    // If raw has invalid characters (paste of "abc"), silently drop the keystroke.
  };

  return (
    <View>
      {keys.map((key) => {
        const persisted = valueByKey.get(key);
        const unit = persisted?.unit ?? defaultUnitFor(key);
        const draft = drafts[key] ?? (persisted ? formatPersisted(persisted.value) : '');
        return (
          <TextField
            key={key}
            label={`${MEASUREMENT_KEY_LABEL[key]} (${unit})`}
            keyboardType="decimal-pad"
            value={draft}
            onChangeText={(text: string) => handleChange(key, text)}
            placeholder="0"
          />
        );
      })}
    </View>
  );
};

const emptyBox: ViewStyle = {
  paddingVertical: space.md,
  paddingHorizontal: space.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  backgroundColor: colors.surface,
};

const emptyText = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;
