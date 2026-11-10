import type { LevelTimer } from './level-timer';
import type { Outcome } from './outcome';
import type { Resolution } from './resolution';
import type { IGameRules } from './rules';
import type { ITimed } from './timed';

// Decorator (statement §3.3, classes.md decision 19, D14): it times a game around any rules.
// `GameEngine` calls only `playTurn()`, and `BaseGameRules.playTurn()` calls its own `evaluate()`.
// So this class reads the outcome of the whole turn in `playTurn()`.
// The other steps only pass to the inner rules: a caller can ask them outside a turn,
// and a question does not move the clock.
// A rejected move starts nothing and stops nothing.
export class TimedRulesDecorator<TMove, TState> implements IGameRules<TMove, TState> {
  constructor(
    protected readonly inner: IGameRules<TMove, TState>,
    private readonly timer: LevelTimer,
  ) {}

  isValid(state: TState, move: TMove): boolean {
    return this.inner.isValid(state, move);
  }

  validMoves(state: TState): Iterable<TMove> {
    return this.inner.validMoves(state);
  }

  apply(state: TState, move: TMove): TState {
    return this.inner.apply(state, move);
  }

  resolve(state: TState): Resolution {
    return this.inner.resolve(state);
  }

  evaluate(state: TState): Outcome {
    return this.inner.evaluate(state);
  }

  playTurn(state: TState, move: TMove): Resolution {
    const resolution = this.inner.playTurn(state, move);
    if (!resolution.accepted) return resolution;
    this.timer.start();
    if (resolution.outcome !== 'playing') this.timer.stop();
    return resolution;
  }

  timed(): ITimed {
    return this.timer;
  }
}
