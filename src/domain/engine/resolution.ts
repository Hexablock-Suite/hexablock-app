import { Outcome } from './outcome';

// The result of one turn: whether the rules accepted the move, and the outcome that
// `evaluate()` gave. It holds no state (classes.md decision 26, DA16 (b) of the redesign plan).
// The rules change the state in place, so the engine reads the state that it gave to the rules.
// It is a value object (classes.md decision 26). It is immutable and it has no identity.
// `equals()` compares the two values. It asks the outcome for its own `equals()`.
export class Resolution {
  private constructor(
    readonly accepted: boolean,
    readonly outcome: Outcome,
  ) {}

  // The rules refused the move, so the state does not change.
  static rejected(): Resolution {
    return new Resolution(false, Outcome.playing);
  }

  // The rules applied and resolved the move. `evaluate()` has not run yet.
  static resolved(): Resolution {
    return new Resolution(true, Outcome.playing);
  }

  // Only an accepted move gets an outcome. A rejected move ends no game.
  evaluated(outcome: Outcome): Resolution {
    if (!this.accepted) throw new RangeError('A rejected resolution cannot be evaluated.');
    return new Resolution(this.accepted, outcome);
  }

  // Two resolutions are equal when both values match.
  equals(other: Resolution): boolean {
    return this.accepted === other.accepted && this.outcome.equals(other.outcome);
  }
}
