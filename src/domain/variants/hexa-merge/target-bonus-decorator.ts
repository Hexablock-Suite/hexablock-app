import type { GridAxis } from '../../engine/grid-topology';
import { Score } from '../../engine/score';
import { ScoringDecorator } from '../../engine/scoring-decorator';
import type { MergeSnapshot, MergeState } from './merge-state';
import type { MergeTile } from './merge-tile';

// The points that the slide which first makes the target tile adds.
const TARGET_BONUS = 1000;

// Decorator (classes.md patterns table): a bonus over the Merge scoring.
// It is a jury variation of the scoring (APP-NFR-06, issue #53).
// The slide that first makes the target tile scores `TARGET_BONUS` more points.
// The photo before the slide tells whether the game made the target earlier.
// The target stays reached (A3), so a later slide gets no bonus.
// `super.score()` gives the score of the inner policy.
// It takes a slide on any axis, as `MergeFactory` does, so it declares no axis parameter.
export class TargetBonusDecorator<TCoord> extends ScoringDecorator<
  MergeState<MergeTile, TCoord, GridAxis>
> {
  score(
    before: MergeSnapshot<MergeTile, TCoord, GridAxis>,
    after: MergeSnapshot<MergeTile, TCoord, GridAxis>,
  ): Score {
    const inner = super.score(before, after);
    if (before.hasReachedTarget() || !after.hasReachedTarget()) return inner;
    return inner.add(Score.of(TARGET_BONUS));
  }
}
