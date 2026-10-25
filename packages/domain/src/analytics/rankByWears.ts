import type { AnalyticsItem } from './types';

/** Most-worn items first (ties by name). Unworn items are excluded. */
export const rankByWears = <T extends AnalyticsItem>(items: readonly T[], limit: number): T[] =>
  items
    .filter((it) => it.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name))
    .slice(0, limit);
