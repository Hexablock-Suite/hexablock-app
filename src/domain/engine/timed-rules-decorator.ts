import type { LevelTimer } from './level-timer';
import type { Resolution } from './resolution';
import type { IGameRules } from './rules';

// Decorator (statement §3.3, classes.md decision 19, D14): it times a game around any rules.
// `GameEngine` calls only `playTurn()`, and `BaseGameRules.playTurn()` calls its own `evaluate()`.
// So this class reads the outcome of the whole turn in `playTurn()`.
// It wraps the two members of `IGameRules` (issue #413). `validMoves()` only passes
// to the inner rules, and a question does not move the clock.
// A rejected move starts nothing and stops nothing.
// The decorator hands out no timer. `GameFactory` gives the same timer to the root,
// and the root reads the time of play from it (classes.md decision 27, issue #234).
export class TimedRulesDecorator<TMove, TState> implements IGameRules<TMove, TState> {
  constructor(
    private readonly inner: IGameRules<TMove, TState>,
    private readonly timer: LevelTimer,
  ) {}

  validMoves(state: TState): Iterable<TMove> {
    return this.inner.validMoves(state);
  }

  playTurn(state: TState, move: TMove): Resolution {
    const resolution = this.inner.playTurn(state, move);
    if (!resolution.wasAccepted()) return resolution;
    this.timer.start();
    if (resolution.endsTheGame()) this.timer.stop();
    return resolution;
  }
}
