import type { Resolution } from '../../engine/resolution';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { SortState } from './sort-state';

// The points of each tile in a cleared stack. The accepted rule of issue #59 (D22,
// 2026-11-06): a cleared stack of 10 tiles gives 100 points.
export const SORT_POINTS_PER_TILE = 10;

// The scoring of Hexa Sort (issue #98, APP-FR-06). Statement §1.3 defines no points,
// so it codes the accepted rule of issue #59 (D22): each tile of a stack that the turn
// clears gives `SORT_POINTS_PER_TILE`, and a turn that clears nothing gives 0.
// A won Sort level also gets stars by moves (`sortStars`).
// The rules reset `clearedTiles` on each turn, so the new state holds only this turn.
// The scoring keeps no game data (classes.md decision 26).
export class SortScoring<TCoord> implements IScoringPolicy<SortState<TCoord>> {
  score(_before: SortState<TCoord>, resolution: Resolution<SortState<TCoord>>): number {
    const tiles = resolution.state.clearedTiles.reduce((sum, size) => sum + size, 0);
    return tiles * SORT_POINTS_PER_TILE;
  }
}
