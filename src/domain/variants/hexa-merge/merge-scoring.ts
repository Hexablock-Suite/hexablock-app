import type { GridAxis } from '../../engine/grid-topology';
import { Score } from '../../shared/score';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { MergeSnapshot, MergeState } from './merge-state';
import type { MergeTile } from './merge-tile';

// Strategy (D1): the scoring of Hexa Merge (issue 97, statement §1.4).
// It codes the accepted rule of issue #59 (D22, 2026-11-06):
// a slide scores the sum of the values that its merges make.
// `mergedTiles()` of the photo gives only the merged tiles, so the new tile of the turn adds nothing.
// It asks the photo after the turn for the turn facts, so it keeps no game data
// (classes.md decision 26). It gives the points as a `Score` (decision 41).
export class MergeScoring<TCoord, TAxis extends GridAxis> implements IScoringPolicy<
  MergeState<MergeTile, TCoord, TAxis>
> {
  score(
    _before: MergeSnapshot<MergeTile, TCoord, TAxis>,
    after: MergeSnapshot<MergeTile, TCoord, TAxis>,
  ): Score {
    return after.mergedTiles().reduce((sum, tile) => sum.add(tile.points()), Score.of(0));
  }
}
