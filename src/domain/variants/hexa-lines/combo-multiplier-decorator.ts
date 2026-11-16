import type { Score } from '../../engine/score';
import { ScoringDecorator } from '../../engine/scoring-decorator';
import type { LinesScoring } from './lines-scoring';
import type { LinesSnapshot, LinesState } from './lines-state';

// Decorator (classes.md patterns table): it wraps the base `LinesScoring` and multiplies
// the line bonus for the combo and the streak (statement §1.1). The cell points keep factor 1.
// The multiplier codes the accepted rule of issue #59 (D22, 2026-11-06): `lines + streak - 1`. One line with streak 1 gives factor 1.
// The streak counts the current placement (issue 58), so a second clearing placement in a row
// has streak 2. It extends the engine `ScoringDecorator` with `LinesScoring` as its inner
// policy (view variant-1-lines), and `super.score()` gives the base score.
// It reads the photo after the turn, as the base policy does.
// The streak and the count of lines keep their numbers private (issue #232). So the streak
// gives the combo bonus: the line bonus `multiplier - 1` more times, as a `Score`.
// A placement that clears no line has no bonus, so the decorator adds nothing to the inner score.
export class ComboMultiplierDecorator<TCoord> extends ScoringDecorator<
  LinesState<TCoord>,
  LinesScoring<TCoord>
> {
  score(before: LinesSnapshot<TCoord>, after: LinesSnapshot<TCoord>): Score {
    return super.score(before, after).add(after.streak.comboBonus(after.linesCleared));
  }
}
