import type { GarmentItem, Measurement } from '@seam/shared';
import { compareMeasurements } from '../compare/compareMeasurements';
import { getMeasurementDiffSeverity } from '../compare/getMeasurementDiffSeverity';

export type SizeScoreAnchor = {
  item: GarmentItem;
  measurements: Measurement[];
};

const NEUTRAL = 70;
const MIN = 0;
const MAX = 100;

const clamp = (n: number): number => Math.max(MIN, Math.min(MAX, n));

/**
 * Heuristic 0-100 score for "how well does this candidate fit my body" derived
 * from how close its measurements are to one or more known-good anchors.
 *
 * Strategy
 * ────────
 * - With no anchors we return the neutral score (70) — we have no signal.
 * - For each anchor we compute every comparable measurement diff, classify
 *   the severity, and accumulate +20 / +15 / +5 / -10 (same / close /
 *   different / warning).
 * - The candidate's score is the *best* anchor score (we trust the closest
 *   match more than averaging across mediocre fits).
 */
export const calculateSizeScore = (
  candidate: GarmentItem,
  candidateMeasurements: readonly Measurement[],
  anchors: readonly SizeScoreAnchor[],
): number => {
  if (anchors.length === 0) return NEUTRAL;

  let bestScore = -Infinity;
  for (const anchor of anchors) {
    const diffs = compareMeasurements(
      candidateMeasurements,
      anchor.measurements,
      candidate.category,
    );
    if (diffs.length === 0) continue;
    let delta = 0;
    for (const d of diffs) {
      const severity = getMeasurementDiffSeverity(d, candidate.category);
      switch (severity) {
        case 'same':
          delta += 20;
          break;
        case 'close':
          delta += 15;
          break;
        case 'different':
          delta += 5;
          break;
        case 'warning':
          delta -= 10;
          break;
      }
    }
    const anchorScore = NEUTRAL + delta;
    if (anchorScore > bestScore) bestScore = anchorScore;
  }

  if (bestScore === -Infinity) return NEUTRAL;
  return clamp(bestScore);
};
