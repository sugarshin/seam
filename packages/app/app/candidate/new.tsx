import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { ItemForm, type ItemFormDefaults, type ItemFormSubmit } from '../../src/forms/ItemForm';
import { Button, TextField } from '../../src/components';
import { createItemWithDetails, tagRepository } from '../../src/repositories';
import { font, space, useThemeColors } from '../../src/theme';
import { ImportUrlError, importMercariUrl } from '../../src/utils/importMercariUrl';
import { testIds } from '../../src/utils/testIds';

const INITIAL_DEFAULTS: ItemFormDefaults = { values: { status: 'wishlist' } };

export default function NewCandidateScreen() {
  const palette = useThemeColors();
  const [submitting, setSubmitting] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [defaults, setDefaults] = useState<ItemFormDefaults>(INITIAL_DEFAULTS);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    void tagRepository.listAll().then((tags) => setTagSuggestions(tags.map((t) => t.name)));
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const next = await importMercariUrl(importUrl);
      setDefaults(next);
      setFormKey((k) => k + 1);
      setImportUrl('');
    } catch (err) {
      const msg =
        err instanceof ImportUrlError
          ? err.message
          : err instanceof Error
            ? err.message
            : '取り込みに失敗しました';
      Alert.alert('取り込み失敗', msg);
    } finally {
      setImporting(false);
    }
  }, [importUrl]);

  const handleSubmit = useCallback(async (input: ItemFormSubmit) => {
    setSubmitting(true);
    try {
      await createItemWithDetails({
        item: input.item,
        measurements: input.measurements,
        photos: input.photos,
        tags: input.tags,
        fitAnchorName: input.fitAnchorName,
        fitAnchorNotes: input.fitAnchorNotes,
        candidateInfo: input.candidateInfo,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/wishlist');
    } catch (err) {
      Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: '購入候補を追加' }} />
      <View
        style={{
          backgroundColor: palette.surface,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: space.md,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        <Text
          style={{
            fontSize: font.size.xs,
            color: palette.textMuted,
            fontWeight: font.weight.semibold,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: space.sm,
          }}
        >
          URL から取り込み
        </Text>
        <TextField
          value={importUrl}
          onChangeText={setImportUrl}
          placeholder="https://jp.mercari.com/item/..."
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          hint="メルカリの商品 URL を貼り付けると名前・価格・画像 1 枚を自動入力します"
          testID={testIds.field.importUrl}
        />
        <Button
          label="取り込む"
          onPress={() => void handleImport()}
          loading={importing}
          disabled={importUrl.trim() === ''}
          variant="secondary"
          testID={testIds.btn.importUrl}
        />
      </View>
      <ItemForm
        key={formKey}
        tagSuggestions={tagSuggestions}
        submitting={submitting}
        submitLabel="登録"
        onSubmit={handleSubmit}
        defaults={defaults}
        onCancel={() => {
          if (router.canGoBack()) router.back();
        }}
      />
    </View>
  );
}
