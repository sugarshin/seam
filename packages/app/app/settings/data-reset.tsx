import { useState } from 'react';
import { Alert, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button } from '../../src/components/Button';
import { resetAllData } from '../../src/backup/dataReset';
import { colors, font, radii, space } from '../../src/theme';

export default function DataResetScreen() {
  const [busy, setBusy] = useState(false);

  const onConfirm = (): void => {
    Alert.alert(
      '本当に削除しますか？',
      'すべてのアイテム、写真、履歴が削除されます。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await resetAllData();
                Alert.alert(
                  '削除しました',
                  'アプリを完全に再起動することをおすすめします。',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/(tabs)/settings');
                      },
                    },
                  ],
                );
              } catch (err) {
                Alert.alert('削除失敗', err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'データを全削除', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <View style={warningCard}>
          <Text style={warningTitle}>すべてのデータが消えます</Text>
          <Text style={warningBody}>
            この操作は取り消せません。実行する前に Settings → JSON エクスポートで
            バックアップを取ることを強く推奨します。
          </Text>
          <View style={{ height: space.md }} />
          <Text style={warningBody}>削除対象:</Text>
          <Text style={listItem}>• すべてのアイテム / 候補 / Fit Anchor</Text>
          <Text style={listItem}>• 実寸 / 写真 / タグ</Text>
          <Text style={listItem}>• 判定履歴 / 着用履歴 / 落札失敗履歴 / 価格履歴</Text>
          <Text style={listItem}>• ブランドガイド / 個人ルール</Text>
          <Text style={listItem}>• 通知リマインダー</Text>
        </View>

        <Button
          label={busy ? '削除中…' : 'すべて削除する'}
          onPress={onConfirm}
          loading={busy}
        />
        <Button
          label="キャンセル"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/settings');
          }}
          variant="ghost"
        />
      </ScrollView>
    </View>
  );
}

const warningCard: ViewStyle = {
  borderWidth: 1,
  borderColor: colors.warning,
  borderRadius: radii.md,
  backgroundColor: colors.surface,
  padding: space.lg,
};

const warningTitle = {
  color: colors.warning,
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  marginBottom: space.sm,
} as const;

const warningBody = {
  color: colors.text,
  fontSize: font.size.sm,
  lineHeight: 20,
} as const;

const listItem = {
  color: colors.text,
  fontSize: font.size.sm,
  marginTop: space.xs,
} as const;
