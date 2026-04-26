import { describe, it, expect } from 'vitest';
import { canTransitionStatus, isCandidateStatus, ITEM_STATUSES } from './itemStatus';

describe('itemStatus', () => {
  it('lists 8 statuses (no `bought`)', () => {
    expect(ITEM_STATUSES).toHaveLength(8);
    expect(ITEM_STATUSES).not.toContain('bought');
  });

  it('allows wishlist → owned (purchase shortcut)', () => {
    expect(canTransitionStatus('wishlist', 'owned')).toBe(true);
  });

  it('allows bidding → lost_auction', () => {
    expect(canTransitionStatus('bidding', 'lost_auction')).toBe(true);
  });

  it('rejects sold → owned', () => {
    expect(canTransitionStatus('sold', 'owned')).toBe(false);
  });

  it('treats wishlist/watching/bidding/negotiating as candidate', () => {
    expect(isCandidateStatus('wishlist')).toBe(true);
    expect(isCandidateStatus('watching')).toBe(true);
    expect(isCandidateStatus('bidding')).toBe(true);
    expect(isCandidateStatus('negotiating')).toBe(true);
    expect(isCandidateStatus('owned')).toBe(false);
    expect(isCandidateStatus('sold')).toBe(false);
  });
});
