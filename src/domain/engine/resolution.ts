import type { Outcome } from './outcome';

// The result of one turn: whether the rules accepted the move, and the outcome that
// `evaluate()` gave. It holds no state (classes.md decision 26, DA16 (b) of the redesign plan).
// The rules change the state in place, so the engine reads the state that it gave to the rules.
// It has no tactical stereotype (classes.md decision 26).
export class Resolution {
  private constructor(
    readonly accepted: boolean,
    readonly outcome: Outcome,
  ) {}

  // The rules refused the move, so the state does not change.
  static rejected(): Resolution {
    return new Resolution(false, 'playing');
  }

  // The rules applied and resolved the move. `evaluate()` has not run yet.
  static resolved(): Resolution {
    return new Resolution(true, 'playing');
  }

  // Only an accepted move gets an outcome. A rejected move ends no game.
  evaluated(outcome: Outcome): Resolution {
    if (!this.accepted) throw new RangeError('A rejected resolution cannot be evaluated.');
    return new Resolution(this.accepted, outcome);
  }
}
