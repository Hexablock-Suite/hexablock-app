import type { Score } from '../../engine/score';
import { ScoringDecorator } from '../../engine/scoring-decorator';
import type { LinesScoring } from './lines-scoring';
import type { LinesSnapshot, LinesState } from './lines-state';

// Decorator (classes.md patterns table): it wraps the base `LinesScoring` and multiplies
// the line bonus for the combo and the streak (statement §1.1). The cell points keep factor 1.
// The multiplier codes the accepted rule of issue #59 (D22, 2026-11-06): `lines + streak - 1`. One line with streak 1 gives factor 1.
// The streak counts the current placement (issue 58), so a second clearing placement in a row
// has streak 2. It extends the engine `ScoringDecorator` with `LinesScoring` as its inner
// policy (view variant-1-lines), because it reads `inner.lineBonus()`.
// It reads the photo after the turn, as the base policy does.
// A placement that clears no line has no bonus, so the decorator adds nothing to the inner score.
// `Score.times()` multiplies the bonus, so no number of a score leaves its value object.
export class ComboMultiplierDecorator<TCoord> extends ScoringDecorator<
  LinesState<TCoord>,
  LinesScoring<TCoord>
> {
  score(before: LinesSnapshot<TCoord>, after: LinesSnapshot<TCoord>): Score {
    const base = super.score(before, after);
    if (after.linesCleared === 0) return base;
    return base.add(this.inner.lineBonus(after).times(multiplier(after) - 1));
  }
}

// The multiplier of a placement that clears a line. The streak counts that placement,
// so the multiplier is 1 or more.
function multiplier<TCoord>(after: LinesSnapshot<TCoord>): number {
  return after.linesCleared + after.streak - 1;
}
