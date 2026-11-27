import type { Score } from '../../shared/score';
import { ScoringDecorator } from '../../engine/scoring-decorator';
import type { LinesSnapshot, LinesState } from './lines-state';

// Decorator (classes.md patterns table): it wraps the base `LinesScoring` and multiplies
// the line bonus for the combo and the streak (statement §1.1). The cell points keep factor 1.
// The multiplier codes the accepted rule of issue #59 (D22, 2026-11-06): `lines + streak - 1`.
// One line with streak 1 gives factor 1.
// The streak counts the current placement (issue 58), so a second clearing placement in a row
// has streak 2. It extends the engine `ScoringDecorator`, and `super.score()` gives the score
// of the inner policy. It reads no member of `LinesScoring`, so it binds no inner type
// and names only the state (issue #427, view variant-1-lines).
// It asks the photo after the turn, as the base policy does.
// The streak and the count of lines keep their numbers private (issue #232). So the streak
// builds the `ComboFactor` from the lines, and the count of lines applies it to its line bonus.
// A placement that clears no line has no factor, so the decorator adds nothing to the inner score.
export class ComboMultiplierDecorator<TCoord> extends ScoringDecorator<LinesState<TCoord>> {
  score(before: LinesSnapshot<TCoord>, after: LinesSnapshot<TCoord>): Score {
    const score = super.score(before, after);
    const lines = after.lastCombo();
    if (lines.isNone()) return score;
    return score.add(lines.comboBonus(after.currentStreak().comboFactor(lines)));
  }
}
