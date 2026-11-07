import type { Resolution } from '../../engine/resolution';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { MergeState } from './merge-state';
import type { MergeTile } from './merge-tile';

// Strategy (D1): the scoring of Hexa Merge (issue 97, statement §1.4).
// It codes against the proposal on issue 59, «Propuesta, pendiente del equipo
// (cola nocturna, 2026-11-06)»: a slide scores the sum of the values that its merges make.
// `MergeState.merged` holds only the merged tiles, so the new tile of the turn adds nothing.
// It reads the turn facts from the state, so it keeps no game data (classes.md decision 26).
export class MergeScoring<TCoord, TAxis extends string> implements IScoringPolicy<
  MergeState<MergeTile, TCoord, TAxis>
> {
  score(
    _before: MergeState<MergeTile, TCoord, TAxis>,
    resolution: Resolution<MergeState<MergeTile, TCoord, TAxis>>,
  ): number {
    return resolution.state.merged.reduce((sum, tile) => sum + tile.value, 0);
  }
}
