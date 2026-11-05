import type { BoardState } from './board-state';
import { GameOver, type GameEventPublisher } from './game-events';
import type { GameId } from './game-id';
import { PlayingPhase, ResolvingPhase, type GamePhase } from './game-phase';
import type { Outcome } from './outcome';
import type { IGameRules } from './rules';
import type { IScoringPolicy } from './scoring-policy';

// The aggregate root of one game (classes.md decision 26).
// A game changes only through `play()`, and `play()` applies a move only while
// `phase.canPlay()` is true. `snapshot()` returns a clone, so no caller changes the board.
// The engine depends only on the interfaces of the rules and the scoring (Strategy, D1).
export class GameEngine<TCell, TCoord, TMove, TState extends BoardState<TCell, TCoord>> {
  private state: TState | undefined;
  private current: GamePhase = PlayingPhase.instance;

  constructor(
    private readonly gameId: GameId,
    private readonly rules: IGameRules<TCell, TMove, TState>,
    private readonly scoring: IScoringPolicy<TState>,
    private readonly events: GameEventPublisher,
  ) {}

  get phase(): GamePhase {
    return this.current;
  }

  // Starts a game from a copy of `initial`, so the caller keeps no reference to the board.
  start(initial: TState): void {
    this.state = copy(initial);
    this.current = PlayingPhase.instance;
  }

  // One turn: receive the move, let the rules validate, apply, resolve and evaluate it
  // (template method `playTurn()`), score it, and notify when the game ends.
  play(move: TMove): Outcome {
    const state = this.started();
    if (!this.current.canPlay()) {
      throw new RangeError(`The game cannot accept a move in the ${this.current.name} phase.`);
    }
    this.current = ResolvingPhase.instance;
    // The rules and the scoring work on a copy. The engine keeps its state until both
    // succeed, so an exception leaves the board, the score and the phase as they were.
    let resolution;
    try {
      resolution = this.rules.playTurn(copy(state), move);
      if (resolution.accepted) {
        resolution.state.score += this.scoring.score(state, resolution);
      }
    } catch (error) {
      this.current = PlayingPhase.instance;
      throw error;
    }
    if (!resolution.accepted) {
      this.current = PlayingPhase.instance;
      return resolution.outcome;
    }
    const next = resolution.state;
    this.state = next;
    this.current = this.current.after(resolution.outcome);
    if (resolution.outcome !== 'playing') {
      this.events.publish(new GameOver(this.gameId, resolution.outcome, next.score));
    }
    return resolution.outcome;
  }

  pause(): void {
    this.current = this.current.pause();
  }

  resume(): void {
    this.current = this.current.resume();
  }

  snapshot(): TState {
    return copy(this.started());
  }

  private started(): TState {
    if (this.state === undefined) throw new RangeError('The game has not started.');
    return this.state;
  }
}

// `BoardState.clone()` of a variant state returns that variant state (see board-state.ts).
function copy<TState extends BoardState<unknown, unknown>>(state: TState): TState {
  return state.clone() as TState;
}
