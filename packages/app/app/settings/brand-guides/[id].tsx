import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  CATEGORY_LABEL,
  GARMENT_CATEGORIES,
  type BrandGuide,
  type GarmentCategory,
} from '@seam/shared';
import { Button } from '../../../src/components/Button';
import { Picker, type PickerOption } from '../../../src/components/Picker';
import { TextField } from '../../../src/components/TextField';
import { brandGuideRepository } from '../../../src/repositories';
import { font, space, useThemeColors } from '../../../src/theme';
import { testIds } from '../../../src/utils/testIds';

const CATEGORY_OPTIONS: readonly PickerOption<GarmentCategory>[] = GARMENT_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABEL[c],
}));

export default function BrandGuideEditScreen() {
  const palette = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const guideId = typeof id === 'string' ? id : undefined;

  const [guide, setGuide] = useState<BrandGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [brand, setBrand] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GarmentCategory | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [checklistText, setChecklistText] = useState('');

  const load = useCallback(async () => {
    if (!guideId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const g = await brandGuideRepository.getById(guideId);
      setGuide(g);
      if (g) {
        setBrand(g.brand);
        setTitle(g.title);
        setCategory(g.category);
        setNotes(g.notes);
        setChecklistText(g.checklistItems.join('\n'));
      }
    } finally {
      setLoading(false);
    }
  }, [guideId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!guideId) return;
    if (brand.trim().length === 0 || title.trim().length === 0) {
      Alert.alert('入力エラー', 'ブランドとタイトルは必須です。');
      return;
    }
    setSubmitting(true);
    try {
      const checklistItems = checklistText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      await brandGuideRepository.update(guideId, {
        brand: brand.trim(),
        title: title.trim(),
        category,
        notes: notes.trim(),
        checklistItems,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/settings/brand-guides');
    } catch (err) {
      Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [guideId, brand, title, category, notes, checklistText]);

  const centerStyle: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: palette.bg,
  };
  const mutedStyle = {
    color: palette.textMuted,
    fontSize: font.size.sm,
  } as const;

  if (!guideId) {
    return (
      <View style={centerStyle}>
        <Text style={mutedStyle}>不正な ID です</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={centerStyle}>
        <ActivityIndicator color={palette.text} />
      </View>
    );
  }
  if (!guide) {
    return (
      <View style={centerStyle}>
        <Text style={mutedStyle}>ガイドが見つかりません</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'ガイド編集' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <TextField
          label="ブランド"
          value={brand}
          onChangeText={setBrand}
          required
          testID={testIds.field.guideBrand}
        />
        <TextField
          label="タイトル"
          value={title}
          onChangeText={setTitle}
          required
          testID={testIds.field.guideTitle}
        />
        <Picker<GarmentCategory>
          label="カテゴリ (任意)"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={setCategory}
          modalTitle="カテゴリ"
          testID={testIds.picker.guideCategory}
        />
        <TextField
          label="ノート"
          value={notes}
          onChangeText={setNotes}
          multiline
          testID={testIds.field.guideNotes}
        />
        <TextField
          label="チェックリスト (1 行 1 項目)"
          value={checklistText}
          onChangeText={setChecklistText}
          multiline
          hint="改行で項目を区切ります。空行は無視されます。"
          testID={testIds.field.guideChecklist}
        />
        <Button
          label="保存"
          onPress={onSave}
          loading={submitting}
          testID={testIds.btn.saveBrandGuide}
        />
      </ScrollView>
    </>
  );
}
