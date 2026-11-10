import type { Outcome } from './outcome';

// State (statement §3.3, D2): the phase of one game. Each phase is one class.
// A phase holds no data, so each class has one shared instance.
// The menu is navigation in the presentation layer, so no menu phase exists (D14).
// A phase keeps its name private. It names itself only in the error of a refusal.
export interface GamePhase {
  canPlay(): boolean;
  // Throws a RangeError that names the phase when the phase accepts no move.
  checkAcceptsMove(): void;
  // Throws a RangeError that names the phase when the phase accepts no undo.
  checkAcceptsUndo(): void;
  // The phase that follows a resolved turn.
  after(outcome: Outcome): GamePhase;
  pause(): GamePhase;
  resume(): GamePhase;
}

function phaseOf(outcome: Outcome): GamePhase {
  switch (outcome) {
    case 'playing':
      return PlayingPhase.instance;
    case 'victory':
      return VictoryPhase.instance;
    case 'game-over':
      return GameOverPhase.instance;
    default: {
      // A value outside the `Outcome` union reaches this branch only through a cast.
      const unknown: never = outcome;
      throw new RangeError(`Unknown outcome: ${String(unknown)}.`);
    }
  }
}

export class PlayingPhase implements GamePhase {
  static readonly instance = new PlayingPhase();
  private constructor() {}
  canPlay(): boolean {
    return true;
  }
  checkAcceptsMove(): void {
    // The playing phase accepts every move.
  }
  checkAcceptsUndo(): void {
    // The playing phase accepts every undo.
  }
  after(outcome: Outcome): GamePhase {
    return phaseOf(outcome);
  }
  pause(): GamePhase {
    return PausedPhase.instance;
  }
  resume(): GamePhase {
    return this;
  }
}

// A phase that accepts no move and no undo. Only this class reads the name of the phase.
abstract class RefusingPhase implements GamePhase {
  protected constructor(private readonly name: string) {}
  canPlay(): boolean {
    return false;
  }
  checkAcceptsMove(): void {
    throw new RangeError(`The game cannot accept a move in the ${this.name} phase.`);
  }
  checkAcceptsUndo(): void {
    throw new RangeError(`The game cannot accept an undo in the ${this.name} phase.`);
  }
  abstract after(outcome: Outcome): GamePhase;
  abstract pause(): GamePhase;
  abstract resume(): GamePhase;
}

// The engine applies and resolves a move. No other move is accepted until it ends.
export class ResolvingPhase extends RefusingPhase {
  static readonly instance = new ResolvingPhase();
  private constructor() {
    super('resolving');
  }
  after(outcome: Outcome): GamePhase {
    return phaseOf(outcome);
  }
  pause(): GamePhase {
    return this;
  }
  resume(): GamePhase {
    return this;
  }
}

export class PausedPhase extends RefusingPhase {
  static readonly instance = new PausedPhase();
  private constructor() {
    super('paused');
  }
  after(): GamePhase {
    return this;
  }
  pause(): GamePhase {
    return this;
  }
  resume(): GamePhase {
    return PlayingPhase.instance;
  }
}

// An ended phase never changes again.
abstract class EndedPhase extends RefusingPhase {
  after(): GamePhase {
    return this;
  }
  pause(): GamePhase {
    return this;
  }
  resume(): GamePhase {
    return this;
  }
}

export class GameOverPhase extends EndedPhase {
  static readonly instance = new GameOverPhase();
  private constructor() {
    super('game-over');
  }
}

export class VictoryPhase extends EndedPhase {
  static readonly instance = new VictoryPhase();
  private constructor() {
    super('victory');
  }
}
