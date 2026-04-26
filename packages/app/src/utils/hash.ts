/**
 * djb2 string hash → 8-char hex. Stable across runs and platforms; not
 * cryptographically strong, but fine for stable checklist-item keys that
 * survive reorder.
 */
export const hashChecklistText = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    // hash * 33 + c
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  // Normalise to unsigned 32-bit and pad.
  const n = hash >>> 0;
  return n.toString(16).padStart(8, '0');
};
