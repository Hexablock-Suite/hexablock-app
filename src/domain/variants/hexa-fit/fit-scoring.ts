import type { Resolution } from '../../engine/resolution';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { FitState } from './fit-state';

// The points of one Fit turn. The accepted rule of issue #59 (D22, 2026-11-06):
// Fit has no score per turn. Its result is the stars (`fitStars`).
export const FIT_POINTS_PER_TURN = 0;

// The scoring of Hexa Fit (issue #98, APP-FR-06). Statement §1.2 grades a level
// with stars by moves and time, not with points. So each turn gives `FIT_POINTS_PER_TURN`.
// The scoring keeps no game data (classes.md decision 26).
export class FitScoring<TCoord> implements IScoringPolicy<FitState<TCoord>> {
  score(_before: FitState<TCoord>, _resolution: Resolution<FitState<TCoord>>): number {
    return FIT_POINTS_PER_TURN;
  }
}
