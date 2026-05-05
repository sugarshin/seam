import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, router } from 'expo-router';
import { Chip } from '../../src/components/Chip';
import { exportToFile } from '../../src/backup/exportData';
import { exportItemsToCsv } from '../../src/backup/csvExport';
import {
  importFromJsonFile,
  type ImportMode,
  type ImportResult,
} from '../../src/backup/jsonImport';
import {
  getLastExportAt,
  isExportStale,
  setLastExportAt,
} from '../../src/backup/lastExportTracker';
import { shareExportFile } from '../../src/backup/shareExport';
import { nowIso } from '../../src/utils/dates';
import { testIds } from '../../src/utils/testIds';
import { type ColorPalette, font, radii, space, useThemeColors } from '../../src/theme';

const formatLastExport = (iso: string | null): string => {
  if (iso === null) return '未実施';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未実施';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function SettingsScreen() {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [busy, setBusy] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [stale, setStale] = useState<boolean>(false);

  const refreshExportState = useCallback(async () => {
    const [last, isStale] = await Promise.all([getLastExportAt(), isExportStale()]);
    setLastExport(last);
    setStale(isStale);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshExportState();
    }, [refreshExportState]),
  );

  const onExport = async (): Promise<void> => {
    setBusy(true);
    try {
      const version = Application.nativeApplicationVersion ?? '0.0.1';
      const path = await exportToFile(version);
      await setLastExportAt(nowIso());
      await refreshExportState();
      try {
        await shareExportFile(path);
      } catch {
        Alert.alert('保存しました', `バックアップ: ${path}`);
      }
    } catch (err) {
      Alert.alert('エクスポート失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onExportCsv = async (): Promise<void> => {
    setBusy(true);
    try {
      const path = await exportItemsToCsv();
      try {
        await shareExportFile(path);
      } catch {
        Alert.alert('保存しました', `CSV: ${path}`);
      }
    } catch (err) {
      Alert.alert('CSV エクスポート失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runImport = useCallback(
    async (uri: string, mode: ImportMode): Promise<void> => {
      setBusy(true);
      try {
        const result: ImportResult = await importFromJsonFile(uri, { mode });
        const totals = Object.entries(result.insertedCounts)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `${t}: ${n}`)
          .join('\n');
        const summary = totals.length > 0 ? totals : '挿入された行はありません。';
        const errors = result.errors.length > 0 ? `\n\nエラー:\n${result.errors.join('\n')}` : '';
        Alert.alert('インポート完了', `${summary}${errors}`);
        await refreshExportState();
      } catch (err) {
        Alert.alert('インポート失敗', err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refreshExportState],
  );

  const onImport = useCallback(async (): Promise<void> => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    const uri = asset.uri;

    Alert.alert('インポート方法', '既存のデータをどうしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'マージ (重複は無視)',
        onPress: () => {
          void runImport(uri, 'merge');
        },
      },
      {
        text: '上書き (全削除→復元)',
        style: 'destructive',
        onPress: () => {
          Alert.alert('本当に上書きしますか？', '既存のデータはすべて削除されます。', [
            { text: 'キャンセル', style: 'cancel' },
            {
              text: '上書き実行',
              style: 'destructive',
              onPress: () => {
                void runImport(uri, 'replace');
              },
            },
          ]);
        },
      },
    ]);
  }, [runImport]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }}>
      {stale && (
        <View style={styles.warningBanner}>
          <Chip label="30日以上 Export していません" tone="warning" />
          <Text style={styles.warningHint}>
            データ保護のため、月に1回以上 JSON エクスポートを推奨します。
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>バックアップ</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="JSON エクスポート"
          testID={testIds.btn.exportJson}
          disabled={busy}
          onPress={onExport}
          style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.6 }]}
        >
          <Text style={styles.btnLabel}>{busy ? '処理中…' : 'JSON エクスポート'}</Text>
        </Pressable>
        <Text style={styles.kvMuted}>最終 Export: {formatLastExport(lastExport)}</Text>
        <View style={{ height: space.sm }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="CSV エクスポート"
          testID={testIds.btn.exportCsv}
          disabled={busy}
          onPress={onExportCsv}
          style={({ pressed }) => [styles.btnSecondary, (pressed || busy) && { opacity: 0.6 }]}
        >
          <Text style={styles.btnSecondaryLabel}>CSV エクスポート (アイテム)</Text>
        </Pressable>
        <View style={{ height: space.sm }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="JSON インポート"
          testID={testIds.btn.importJson}
          disabled={busy}
          onPress={() => {
            void onImport();
          }}
          style={({ pressed }) => [styles.btnSecondary, (pressed || busy) && { opacity: 0.6 }]}
        >
          <Text style={styles.btnSecondaryLabel}>JSON インポート</Text>
        </Pressable>
        <Text style={styles.hint}>
          書き出した JSON は Files App / iCloud Drive に保存できます。{'\n'}
          iOS の自動 Backup と組み合わせれば、機種変や紛失からデータを守れます。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>個人ルール</Text>
        <Pressable
          accessibilityRole="button"
          testID={testIds.btn.openMeasurementRules}
          onPress={() => router.push('/settings/measurement-rules')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.btnLabel}>個人 NG / Warning ルール</Text>
        </Pressable>
        <Text style={styles.hint}>
          自分の体型に合わない実寸の閾値を登録すると、Compare 画面で警告が表示されます。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ブランドガイド</Text>
        <Pressable
          accessibilityRole="button"
          testID={testIds.btn.openBrandGuides}
          onPress={() => router.push('/settings/brand-guides')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.btnLabel}>ブランド別 見るべきポイント</Text>
        </Pressable>
        <Text style={styles.hint}>
          ブランドごとのノートとチェックリストを登録しておくと、候補画面でその場で参照できます。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>データ管理</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="データを全削除"
          testID={testIds.btn.openDataReset}
          disabled={busy}
          onPress={() => router.push('/settings/data-reset')}
          style={({ pressed }) => [styles.btnDestructive, (pressed || busy) && { opacity: 0.6 }]}
        >
          <Text style={styles.btnDestructiveLabel}>データを全削除…</Text>
        </Pressable>
        <Text style={styles.hint}>
          すべてのアイテム / 写真 / 履歴を削除します。事前に JSON エクスポートを推奨。
        </Text>
      </View>

      <View style={styles.brandFooter}>
        <Image
          source={require('../../assets/logo-mark.png')}
          style={[styles.brandLogo, { tintColor: palette.textMuted }]}
          resizeMode="contain"
          accessibilityLabel="Seam"
        />
        <Text style={[styles.brandVersion, { color: palette.textMuted }]}>
          v{Application.nativeApplicationVersion ?? '0.0.1'}
        </Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (p: ColorPalette) => ({
  warningBanner: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: p.surface,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
    gap: space.sm,
  } as const,
  warningHint: {
    fontSize: font.size.xs,
    color: p.textMuted,
    lineHeight: 16,
  } as const,
  section: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } as const,
  sectionTitle: {
    fontSize: font.size.sm,
    color: p.textMuted,
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase' as const,
    marginBottom: space.md,
    letterSpacing: 0.5,
  } as const,
  btn: {
    backgroundColor: p.bgInverse,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: 'center' as const,
  } as const,
  btnLabel: {
    color: p.textInverse,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  } as const,
  btnSecondary: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: 'center' as const,
  } as const,
  btnSecondaryLabel: {
    color: p.text,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  } as const,
  btnDestructive: {
    backgroundColor: p.warning,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: 'center' as const,
  } as const,
  btnDestructiveLabel: {
    color: p.textInverse,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  } as const,
  hint: {
    marginTop: space.md,
    fontSize: font.size.xs,
    color: p.textMuted,
    lineHeight: 16,
  } as const,
  kvMuted: {
    marginTop: space.sm,
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  brandFooter: {
    alignItems: 'center' as const,
    paddingVertical: space.xxl,
    gap: space.xs,
  } as const,
  brandLogo: {
    width: 96,
    height: 32,
  } as const,
  brandVersion: {
    fontSize: font.size.xs,
    letterSpacing: 0.5,
  } as const,
});
