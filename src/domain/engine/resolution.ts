import type { Outcome } from './outcome';

// The result of one turn: the state after the move, whether the rules accepted the move,
// and the outcome that `evaluate()` gave. It holds the state, which is an entity,
// so it is not a value object. It has no tactical stereotype (classes.md decision 26).
// The state changes in place, so `state` is the same object that the rules received.
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

  // Only an accepted move gets an outcome. A rejected move ends no game.
  evaluated(outcome: Outcome): Resolution<TState> {
    if (!this.accepted) throw new RangeError('A rejected resolution cannot be evaluated.');
    return new Resolution(this.state, this.accepted, outcome);
  }
}
