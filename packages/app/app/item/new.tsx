import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { ItemForm, type ItemFormSubmit } from '../../src/forms/ItemForm';
import { createItemWithDetails, tagRepository } from '../../src/repositories';
import { colors } from '../../src/theme';

export default function NewItemScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  useEffect(() => {
    void tagRepository.listAll().then((tags) => setTagSuggestions(tags.map((t) => t.name)));
  }, []);

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
      else router.replace('/(tabs)/closet');
    } catch (err) {
      Alert.alert('保存失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: '新規アイテム', headerShown: true }} />
      <ItemForm
        tagSuggestions={tagSuggestions}
        submitting={submitting}
        submitLabel="登録"
        onSubmit={handleSubmit}
        onCancel={() => {
          if (router.canGoBack()) router.back();
        }}
      />
    </View>
  );
}
