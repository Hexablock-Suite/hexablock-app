import type { Resolution } from '../../engine/resolution';
import { ScoringDecorator } from '../../engine/scoring-decorator';
import type { LinesScoring } from './lines-scoring';
import type { LinesState } from './lines-state';

// Decorator (classes.md patterns table): it wraps the base `LinesScoring` and multiplies
// the line bonus for the combo and the streak (statement §1.1). The cell points keep factor 1.
// The multiplier codes the accepted rule of issue #59 (D22, 2026-11-06): `lines + streak - 1`. One line with streak 1 gives factor 1.
// The streak counts the current placement (issue 58), so a second clearing placement in a row
// has streak 2. It extends the engine `ScoringDecorator` with `LinesScoring` as its inner
// policy (view variant-1-lines), because it reads `inner.lineBonus()`.
export class ComboMultiplierDecorator<TCoord> extends ScoringDecorator<
  LinesState<TCoord>,
  LinesScoring<TCoord>
> {
  score(before: LinesState<TCoord>, resolution: Resolution<LinesState<TCoord>>): number {
    const { state } = resolution;
    const extra = this.inner.lineBonus(state) * (multiplier(state) - 1);
    return super.score(before, resolution) + extra;
  }
}

// A placement that clears no line has no bonus, so its multiplier has no effect.
function multiplier<TCoord>(state: LinesState<TCoord>): number {
  return state.linesCleared + state.streak - 1;
}
