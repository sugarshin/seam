import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@seam/lastExportAt';
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Returns the ISO timestamp of the last successful export, or null if none.
 */
export const getLastExportAt = async (): Promise<string | null> => {
  const v = await AsyncStorage.getItem(KEY);
  return v ?? null;
};

/**
 * Persist the ISO timestamp of the most recent successful export.
 */
export const setLastExportAt = async (iso: string): Promise<void> => {
  await AsyncStorage.setItem(KEY, iso);
};

/**
 * True when no export has been recorded, or the last one is older than 30 days.
 * Treats unparseable timestamps as stale to be safe (we want to err toward
 * reminding the user, not silently trusting bad state).
 */
export const isExportStale = async (now: Date = new Date()): Promise<boolean> => {
  const last = await getLastExportAt();
  if (last === null) return true;
  const t = new Date(last).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > STALE_MS;
};
