import type { GamePhase } from './game-phase';
import { Outcome } from './outcome';

// The result of one turn: whether the rules accepted the move, and the outcome that
// `evaluate()` gave. It holds no state (classes.md decision 26).
// The rules change the state in place, so the engine reads the state that it gave to the rules.
// It is a value object (classes.md decision 26). It is immutable and it has no identity.
// `equals()` compares the two values. It asks the outcome for its own `equals()`.
// Both fields are private (issue #240). A reader asks a query with a business name.
export class Resolution {
  private constructor(
    private readonly accepted: boolean,
    private readonly outcome: Outcome,
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

  // Tells if the rules accepted the move.
  wasAccepted(): boolean {
    return this.accepted;
  }

  // Tells if the turn ends the game. A rejected move has the outcome `playing`, so it ends none.
  endsTheGame(): boolean {
    return this.outcome.endsTheGame();
  }

  // The phase that follows the turn, when the game was in `phase` during the turn.
  // The phase reads the outcome, so the reader never takes it out of the resolution.
  phaseAfter(phase: GamePhase): GamePhase {
    return phase.after(this.outcome);
  }

  // The outcome that the turn leads to. Two readers need the value itself:
  // the `GameOver` event that `GameEngine` builds carries it,
  // and `ApplyMove` puts it in `MoveResult` (classes.md decisions 26 and 29).
  leadsTo(): Outcome {
    return this.outcome;
  }

  // Two resolutions are equal when both values match.
  equals(other: Resolution): boolean {
    return this.accepted === other.accepted && this.outcome.equals(other.outcome);
  }
}
