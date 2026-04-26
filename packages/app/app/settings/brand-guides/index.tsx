import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
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
import { colors, font, radii, space } from '../../../src/theme';

const CATEGORY_OPTIONS: ReadonlyArray<PickerOption<GarmentCategory>> = GARMENT_CATEGORIES.map(
  (c) => ({ value: c, label: CATEGORY_LABEL[c] }),
);

export default function BrandGuidesScreen() {
  const [guides, setGuides] = useState<BrandGuide[]>([]);
  const [loading, setLoading] = useState(true);

  // form
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
          text: '削除',
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'ブランドガイド', headerShown: true }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <View style={section}>
          <Text style={sectionTitle}>新規追加</Text>
          <TextField
            label="ブランド"
            value={brand}
            onChangeText={setBrand}
            placeholder="例: Champion"
            required
          />
          <TextField
            label="タイトル"
            value={title}
            onChangeText={setTitle}
            placeholder="例: リバースウィーブ 90s 識別ポイント"
            required
          />
          <Picker<GarmentCategory>
            label="カテゴリ (任意)"
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={setCategory}
            modalTitle="カテゴリ"
          />
          <TextField
            label="ノート"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="ブランド全体の注意点・年代特定のコツなど"
          />
          <TextField
            label="チェックリスト (1 行 1 項目)"
            value={checklistText}
            onChangeText={setChecklistText}
            multiline
            placeholder={'例:\n刺繍タグの位置を確認\n洗濯タグの製造国\nバインダー縫いの幅'}
            hint="改行で項目を区切ります。空行は無視されます。"
          />
          <Button label="ガイドを追加" onPress={onSubmit} loading={submitting} />
        </View>

        <View style={section}>
          <Text style={sectionTitle}>登録済み</Text>
          {loading ? (
            <Text style={muted}>読み込み中…</Text>
          ) : guides.length === 0 ? (
            <Text style={muted}>まだガイドがありません。</Text>
          ) : (
            guides.map((g) => (
              <View key={g.id} style={guideCard}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/settings/brand-guides/${g.id}`)}
                  style={({ pressed }) => [
                    { flex: 1 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={guideTitle}>
                    {g.brand} · {g.title}
                  </Text>
                  {g.category && (
                    <Text style={guideSub}>{CATEGORY_LABEL[g.category]}</Text>
                  )}
                  {g.notes && (
                    <Text style={guideNotes} numberOfLines={2}>
                      {g.notes}
                    </Text>
                  )}
                  <Text style={guideMeta}>チェック項目: {g.checklistItems.length}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onDelete(g)}
                  style={({ pressed }) => [deleteBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={deleteLabel}>削除</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const section: ViewStyle = {
  paddingHorizontal: space.lg,
  paddingVertical: space.lg,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
};

const sectionTitle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  fontWeight: font.weight.semibold,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: space.md,
} as const;

const muted = {
  color: colors.textMuted,
  fontSize: font.size.sm,
} as const;

const guideCard: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: space.md,
  paddingVertical: space.md,
  paddingHorizontal: space.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  marginBottom: space.sm,
  backgroundColor: colors.surface,
};

const guideTitle = {
  fontSize: font.size.sm,
  color: colors.text,
  fontWeight: font.weight.semibold,
} as const;

const guideSub = {
  marginTop: 2,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const guideNotes = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.text,
} as const;

const guideMeta = {
  marginTop: space.xs,
  fontSize: font.size.xs,
  color: colors.textMuted,
} as const;

const deleteBtn: ViewStyle = {
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
};

const deleteLabel = {
  fontSize: font.size.sm,
  color: colors.warning,
  fontWeight: font.weight.semibold,
} as const;
