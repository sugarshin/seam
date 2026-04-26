import { describe, expect, it } from 'vitest';
import { hashChecklistText } from './hash';

describe('hashChecklistText', () => {
  it('returns an 8-char hex string', () => {
    const h = hashChecklistText('刺繍タグの位置を確認');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic for identical input', () => {
    expect(hashChecklistText('foo')).toBe(hashChecklistText('foo'));
  });

  it('differs for different inputs', () => {
    expect(hashChecklistText('foo')).not.toBe(hashChecklistText('bar'));
  });

  it('handles empty string', () => {
    expect(hashChecklistText('')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles Japanese strings', () => {
    const a = hashChecklistText('洗濯タグの製造国');
    const b = hashChecklistText('刺繍タグの位置を確認');
    expect(a).not.toBe(b);
  });
});
