import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { newId } from '../utils/ids';

const PHOTOS_DIR = 'photos/';
const THUMB_DIR = 'photos/thumbs/';
const MAX_WIDTH = 2048;
const THUMB_WIDTH = 256;

const ensureDir = async (relative: string): Promise<string> => {
  const abs = `${FileSystem.documentDirectory ?? ''}${relative}`;
  const info = await FileSystem.getInfoAsync(abs);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(abs, { intermediates: true });
  }
  return abs;
};

export type SavedPhoto = {
  id: string;
  /** relative path inside documentDirectory */
  relativePath: string;
  thumbnailRelativePath: string;
};

/**
 * Resize source URI to <= MAX_WIDTH, also generate a thumbnail. Returns relative paths.
 */
export const savePhoto = async (sourceUri: string): Promise<SavedPhoto> => {
  await ensureDir(PHOTOS_DIR);
  await ensureDir(THUMB_DIR);

  const id = newId();
  const fileName = `${id}.jpg`;
  const thumbName = `${id}.jpg`;

  const main = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const mainDest = `${FileSystem.documentDirectory ?? ''}${PHOTOS_DIR}${fileName}`;
  await FileSystem.moveAsync({ from: main.uri, to: mainDest });

  const thumb = await ImageManipulator.manipulateAsync(
    mainDest,
    [{ resize: { width: THUMB_WIDTH } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  const thumbDest = `${FileSystem.documentDirectory ?? ''}${THUMB_DIR}${thumbName}`;
  await FileSystem.moveAsync({ from: thumb.uri, to: thumbDest });

  return {
    id,
    relativePath: `${PHOTOS_DIR}${fileName}`,
    thumbnailRelativePath: `${THUMB_DIR}${thumbName}`,
  };
};

export const deletePhotoFiles = async (
  relativePath: string,
  thumbnailRelativePath?: string,
): Promise<void> => {
  const abs = `${FileSystem.documentDirectory ?? ''}${relativePath}`;
  await FileSystem.deleteAsync(abs, { idempotent: true });
  if (thumbnailRelativePath) {
    const tabs = `${FileSystem.documentDirectory ?? ''}${thumbnailRelativePath}`;
    await FileSystem.deleteAsync(tabs, { idempotent: true });
  }
};

export const absolutePathFor = (relativePath: string): string =>
  `${FileSystem.documentDirectory ?? ''}${relativePath}`;
