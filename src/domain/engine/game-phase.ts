import type { Outcome } from './outcome';

// State (statement §3.3, D2): the phase of one game. Each phase is one class.
// A phase holds no data, so each class has one shared instance.
// The menu is navigation in the presentation layer, so no menu phase exists (D14).
export interface GamePhase {
  readonly name: 'playing' | 'resolving' | 'paused' | 'game-over' | 'victory';
  canPlay(): boolean;
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
  readonly name = 'playing';
  private constructor() {}
  canPlay(): boolean {
    return true;
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

// The engine applies and resolves a move. No other move is accepted until it ends.
export class ResolvingPhase implements GamePhase {
  static readonly instance = new ResolvingPhase();
  readonly name = 'resolving';
  private constructor() {}
  canPlay(): boolean {
    return false;
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

export class PausedPhase implements GamePhase {
  static readonly instance = new PausedPhase();
  readonly name = 'paused';
  private constructor() {}
  canPlay(): boolean {
    return false;
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
abstract class EndedPhase implements GamePhase {
  abstract readonly name: 'game-over' | 'victory';
  canPlay(): boolean {
    return false;
  }
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
  readonly name = 'game-over';
  private constructor() {
    super();
  }
}

export class VictoryPhase extends EndedPhase {
  static readonly instance = new VictoryPhase();
  readonly name = 'victory';
  private constructor() {
    super();
  }
}
