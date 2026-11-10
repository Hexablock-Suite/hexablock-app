import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { MergeSnapshot, MergeState } from './merge-state';
import type { MergeTile } from './merge-tile';

// Strategy (D1): the scoring of Hexa Merge (issue 97, statement §1.4).
// It codes the accepted rule of issue #59 (D22, 2026-11-06):
// a slide scores the sum of the values that its merges make.
// `merged` of the photo holds only the merged tiles, so the new tile of the turn adds nothing.
// It reads the turn facts from the photo after the turn, so it keeps no game data
// (classes.md decision 26).
export class MergeScoring<TCoord, TAxis extends string> implements IScoringPolicy<
  MergeState<MergeTile, TCoord, TAxis>
> {
  score(
    _before: MergeSnapshot<MergeTile, TCoord, TAxis>,
    after: MergeSnapshot<MergeTile, TCoord, TAxis>,
  ): number {
    return after.merged.reduce((sum, tile) => sum + tile.points(), 0);
  }
}
