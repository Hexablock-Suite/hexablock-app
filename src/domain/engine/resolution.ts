import type { Outcome } from './outcome';

// The result of one turn: the new state, whether the rules accepted the move,
// and the outcome that `evaluate()` gave. It is a value object.
export class Resolution<TState> {
  private constructor(
    readonly state: TState,
    readonly accepted: boolean,
    readonly outcome: Outcome,
  ) {}

  // The rules refused the move, so the state does not change.
  static rejected<TState>(state: TState): Resolution<TState> {
    return new Resolution(state, false, 'playing');
  }

  // The rules applied and resolved the move. `evaluate()` has not run yet.
  static resolved<TState>(state: TState): Resolution<TState> {
    return new Resolution(state, true, 'playing');
  }

  evaluated(outcome: Outcome): Resolution<TState> {
    return new Resolution(this.state, this.accepted, outcome);
  }
}
