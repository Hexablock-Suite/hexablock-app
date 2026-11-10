import { Score } from '../../engine/score';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { SortSnapshot, SortState } from './sort-state';

// The points of each tile in a cleared stack. The accepted rule of issue #59 (D22,
// 2026-11-06): a cleared stack of 10 tiles gives 100 points.
export const SORT_POINTS_PER_TILE = 10;

// The scoring of Hexa Sort (issue #98, APP-FR-06). Statement §1.3 defines no points,
// so it codes the accepted rule of issue #59 (D22): each tile of a stack that the turn
// clears gives `SORT_POINTS_PER_TILE`, and a turn that clears nothing gives 0.
// A won Sort level also gets stars by moves (`sortStars`).
// The rules reset `clearedTiles` on each turn, so the photo after the turn holds only this turn.
// The policy gives the points as a `Score` (classes.md decision 41).
// The scoring keeps no game data (classes.md decision 26).
export class SortScoring<TCoord> implements IScoringPolicy<SortState<TCoord>> {
  score(_before: SortSnapshot<TCoord>, after: SortSnapshot<TCoord>): Score {
    const tiles = after.clearedTiles.reduce((sum, size) => sum + size, 0);
    return Score.of(tiles * SORT_POINTS_PER_TILE);
  }
}
