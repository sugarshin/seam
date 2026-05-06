import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
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
import { type ColorPalette, font, radii, space, useThemeColors } from '../../../src/theme';
import { testIds } from '../../../src/utils/testIds';

const CATEGORY_OPTIONS: readonly PickerOption<GarmentCategory>[] = GARMENT_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABEL[c],
}));

export default function BrandGuidesScreen() {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [guides, setGuides] = useState<BrandGuide[]>([]);
  const [loading, setLoading] = useState(true);

  const [brand, setBrand] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GarmentCategory | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGuides(await brandGuideRepository.listAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const reset = () => {
    setBrand('');
    setTitle('');
    setCategory(undefined);
    setNotes('');
    setChecklistText('');
  };

  const onSubmit = useCallback(async () => {
    if (brand.trim().length === 0) {
      Alert.alert('入力エラー', 'ブランド名を入力してください。');
      return;
    }
    if (title.trim().length === 0) {
      Alert.alert('入力エラー', 'タイトルを入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      const checklistItems = checklistText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      await brandGuideRepository.create({
        brand: brand.trim(),
        category,
        title: title.trim(),
        notes: notes.trim(),
        checklistItems,
      });
      reset();
      await load();
    } catch (err) {
      Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [brand, title, category, notes, checklistText, load]);

  const onDelete = useCallback(
    (g: BrandGuide) => {
      Alert.alert('削除しますか？', `「${g.brand} / ${g.title}」を削除します。`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await brandGuideRepository.delete(g.id);
                await load();
              } catch (err) {
                Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: 'ブランドガイド' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>新規追加</Text>
          <TextField
            label="ブランド"
            value={brand}
            onChangeText={setBrand}
            placeholder="例: Champion"
            required
            testID={testIds.field.guideBrand}
          />
          <TextField
            label="タイトル"
            value={title}
            onChangeText={setTitle}
            placeholder="例: リバースウィーブ 90s 識別ポイント"
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
            placeholder="ブランド全体の注意点・年代特定のコツなど"
            testID={testIds.field.guideNotes}
          />
          <TextField
            label="チェックリスト (1 行 1 項目)"
            value={checklistText}
            onChangeText={setChecklistText}
            multiline
            placeholder={'例:\n刺繍タグの位置を確認\n洗濯タグの製造国\nバインダー縫いの幅'}
            hint="改行で項目を区切ります。空行は無視されます。"
            testID={testIds.field.guideChecklist}
          />
          <Button
            label="ガイドを追加"
            onPress={onSubmit}
            loading={submitting}
            testID={testIds.btn.addBrandGuide}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>登録済み</Text>
          {loading ? (
            <Text style={styles.muted}>読み込み中…</Text>
          ) : guides.length === 0 ? (
            <Text style={styles.muted}>まだガイドがありません。</Text>
          ) : (
            guides.map((g) => (
              <View key={g.id} style={styles.guideCard}>
                <Pressable
                  accessibilityRole="button"
                  testID={testIds.cardBrandGuide(g.id)}
                  onPress={() => router.push(`/settings/brand-guides/${g.id}`)}
                  style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.guideTitle}>
                    {g.brand} · {g.title}
                  </Text>
                  {g.category && <Text style={styles.guideSub}>{CATEGORY_LABEL[g.category]}</Text>}
                  {g.notes && (
                    <Text style={styles.guideNotes} numberOfLines={2}>
                      {g.notes}
                    </Text>
                  )}
                  <Text style={styles.guideMeta}>チェック項目: {g.checklistItems.length}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID={`${testIds.cardBrandGuide(g.id)}:delete`}
                  onPress={() => onDelete(g)}
                  style={({ pressed }) => [deleteBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.deleteLabel}>削除</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const deleteBtn: ViewStyle = {
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
};

const makeStyles = (p: ColorPalette) => ({
  section: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  sectionTitle: {
    fontSize: font.size.xs,
    color: p.textMuted,
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: space.md,
  } as const,
  muted: {
    color: p.textMuted,
    fontSize: font.size.sm,
  } as const,
  guideCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radii.md,
    marginBottom: space.sm,
    backgroundColor: p.surface,
  } satisfies ViewStyle,
  guideTitle: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.semibold,
  } as const,
  guideSub: {
    marginTop: 2,
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  guideNotes: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.text,
  } as const,
  guideMeta: {
    marginTop: space.xs,
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  deleteLabel: {
    fontSize: font.size.sm,
    color: p.warning,
    fontWeight: font.weight.semibold,
  } as const,
});
