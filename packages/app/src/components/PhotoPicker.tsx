import { useState } from 'react';
import { Alert, Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from './Button';
import { absolutePathFor, deletePhotoFiles, savePhoto, type SavedPhoto } from '../photos/savePhoto';
import { colors, font, radii, space } from '../theme';

type Props = {
  photos: SavedPhoto[];
  onChange: (photos: SavedPhoto[]) => void;
  max?: number;
};

export const PhotoPicker = ({ photos, onChange, max = 8 }: Props) => {
  const [busy, setBusy] = useState(false);

  const ensureLibraryPermission = async (): Promise<boolean> => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!result.granted) {
      Alert.alert('写真ライブラリへのアクセスが必要です', '設定アプリで許可してください');
      return false;
    }
    return true;
  };

  const ensureCameraPermission = async (): Promise<boolean> => {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    if (!result.granted) {
      Alert.alert('カメラへのアクセスが必要です', '設定アプリで許可してください');
      return false;
    }
    return true;
  };

  const remainingSlots = max - photos.length;

  const handleAddFromLibrary = async (): Promise<void> => {
    if (remainingSlots <= 0) return;
    if (!(await ensureLibraryPermission())) return;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 1,
      });
      if (result.canceled) return;
      const saved: SavedPhoto[] = [];
      for (const asset of result.assets) {
        // eslint-disable-next-line no-await-in-loop -- intentional sequential save
        const s = await savePhoto(asset.uri);
        saved.push(s);
      }
      onChange([...photos, ...saved]);
    } catch (err) {
      Alert.alert('写真の取り込みに失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAddFromCamera = async (): Promise<void> => {
    if (remainingSlots <= 0) return;
    if (!(await ensureCameraPermission())) return;
    setBusy(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled) return;
      const first = result.assets[0];
      if (!first) return;
      const saved = await savePhoto(first.uri);
      onChange([...photos, saved]);
    } catch (err) {
      Alert.alert('写真撮影に失敗', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: SavedPhoto): Promise<void> => {
    try {
      await deletePhotoFiles(target.relativePath, target.thumbnailRelativePath);
    } catch {
      // best effort
    }
    onChange(photos.filter((p) => p.id !== target.id));
  };

  return (
    <View>
      <View style={grid}>
        {photos.map((p) => (
          <View key={p.id} style={cell}>
            <Image
              source={{ uri: absolutePathFor(p.thumbnailRelativePath ?? p.relativePath) }}
              style={img}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void handleRemove(p);
              }}
              style={({ pressed }) => [removeBtn, pressed && { opacity: 0.6 }]}
              hitSlop={6}
            >
              <Text style={removeMark}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      {remainingSlots > 0 ? (
        <View style={btnRow}>
          <View style={{ flex: 1 }}>
            <Button
              label="ライブラリ"
              onPress={() => {
                void handleAddFromLibrary();
              }}
              variant="secondary"
              disabled={busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="カメラ"
              onPress={() => {
                void handleAddFromCamera();
              }}
              variant="secondary"
              disabled={busy}
            />
          </View>
        </View>
      ) : (
        <Text style={limitText}>最大 {max} 枚まで</Text>
      )}
    </View>
  );
};

const grid: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.sm,
  marginBottom: space.sm,
};

const cell: ViewStyle = {
  width: 92,
  height: 92,
  borderRadius: radii.md,
  overflow: 'hidden',
  backgroundColor: colors.surface,
  position: 'relative',
};

const img = {
  width: '100%' as const,
  height: '100%' as const,
};

const removeBtn: ViewStyle = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: 'rgba(0,0,0,0.7)',
  alignItems: 'center',
  justifyContent: 'center',
};

const removeMark = {
  color: colors.textInverse,
  fontSize: font.size.md,
  fontWeight: font.weight.bold,
  lineHeight: font.size.md + 2,
} as const;

const btnRow: ViewStyle = {
  flexDirection: 'row',
  gap: space.sm,
};

const limitText = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  textAlign: 'center' as const,
  paddingVertical: space.sm,
} as const;
