import * as Sharing from 'expo-sharing';

export const shareExportFile = async (path: string): Promise<void> => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('共有機能が使えない端末です');
  }
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Seam バックアップ',
    UTI: 'public.json',
  });
};
