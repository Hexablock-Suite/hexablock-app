import { Score } from '../../shared/score';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { SortSnapshot, SortState } from './sort-state';

// The scoring of Hexa Sort (issue #98, APP-FR-06). Statement §1.3 defines no points,
// so it codes the accepted rule of issue #59 (D22): each tile of a stack that the turn
// clears gives `SORT_POINTS_PER_TILE`, and a turn that clears nothing gives 0.
// `TileCount` keeps its number private (issue #232), so it gives the points of its stack.
// A won Sort level also gets stars by moves (`sortStars`).
// The rules reset the cleared heights on each turn, so the photo after the turn holds only this turn.
// The policy gives the points as a `Score` (classes.md decision 41).
// The scoring keeps no game data (classes.md decision 26).
export class SortScoring<TCoord> implements IScoringPolicy<SortState<TCoord>> {
  score(_before: SortSnapshot<TCoord>, after: SortSnapshot<TCoord>): Score {
    return after.clearedStackHeights().reduce((sum, tiles) => sum.add(tiles.points()), Score.of(0));
  }
}
