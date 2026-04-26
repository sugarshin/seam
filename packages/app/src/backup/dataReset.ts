import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { truncateAllTables } from './jsonImport';

const PHOTOS_DIR = 'photos/';
const LAST_EXPORT_KEY = '@seam/lastExportAt';

/**
 * Wipe absolutely everything: all DB tables, all photo files on disk, and the
 * last-export timestamp. Used by Settings → "データを全削除".
 *
 * Returns when the operation completes; the caller is expected to prompt the
 * user to relaunch the app since some screens may have stale state in React.
 */
export const resetAllData = async (): Promise<void> => {
  // 1. DB rows. Truncate in reverse FK order (handled by truncateAllTables).
  await truncateAllTables();

  // 2. Photo blobs. Removing the whole directory is faster than enumerating
  //    each file. `idempotent: true` makes a missing directory a no-op.
  const photosAbs = `${FileSystem.documentDirectory ?? ''}${PHOTOS_DIR}`;
  await FileSystem.deleteAsync(photosAbs, { idempotent: true });

  // 3. AsyncStorage timestamps. Right now only the export tracker; if more
  //    keys are introduced, prefer adding them here over a blanket clear.
  await AsyncStorage.removeItem(LAST_EXPORT_KEY);
};
