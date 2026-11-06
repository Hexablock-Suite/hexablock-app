import type { BoardState } from './board-state';
import type { Cloneable } from './cloneable';
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
// `TState` is a `BoardState` whose `clone()` returns `TState`, so each copy keeps the state type.
export class GameEngine<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  private state: TState | undefined;
  private current: GamePhase = PlayingPhase.instance;

  constructor(
    private readonly gameId: GameId,
    private readonly rules: IGameRules<TMove, TState>,
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
  // The rollback covers the board, the score and the phase. It does not cover a collaborator
  // that the rules hold, such as the piece source (classes.md decision 31).
  // So a turn that throws after a draw has used that piece, and a retry draws the next piece.
  play(move: TMove): Outcome {
    const state = this.started();
    if (!this.current.canPlay()) {
      throw new RangeError(`The game cannot accept a move in the ${this.current.name} phase.`);
    }
    this.current = ResolvingPhase.instance;
    // The rules and the scoring work on copies. The engine keeps its state until the turn
    // and the next phase are known, so an exception leaves the board, the score and the phase.
    let turn;
    try {
      turn = this.resolveTurn(state, move);
    } catch (error) {
      this.current = PlayingPhase.instance;
      throw error;
    }
    // A rejected move ends no game, whatever outcome the rules give it.
    if (turn === undefined) {
      this.current = PlayingPhase.instance;
      return 'playing';
    }
    this.state = turn.next;
    this.current = turn.phase;
    // The turn is committed before the engine publishes. A publisher that throws
    // does not undo the turn, and `play()` rethrows its error to the caller.
    if (turn.outcome !== 'playing') {
      this.events.publish(new GameOver(this.gameId, turn.outcome, turn.next.score));
    }
    return turn.outcome;
  }

  pause(): void {
    this.started();
    this.current = this.current.pause();
  }

  resume(): void {
    this.current = this.current.resume();
  }

  snapshot(): TState {
    return copy(this.started());
  }

  // Runs the rules and the scoring, and computes the next phase. It changes no engine field.
  // It returns `undefined` for a rejected move.
  private resolveTurn(
    state: TState,
    move: TMove,
  ): { next: TState; phase: GamePhase; outcome: Outcome } | undefined {
    const resolution = this.rules.playTurn(copy(state), move);
    if (!resolution.accepted) return undefined;
    const points = this.scoring.score(copy(state), resolution);
    if (!Number.isFinite(points)) {
      throw new RangeError(`The scoring policy returned a score that is not finite: ${points}.`);
    }
    resolution.state.score += points;
    return {
      next: resolution.state,
      phase: this.current.after(resolution.outcome),
      outcome: resolution.outcome,
    };
  }

  private started(): TState {
    if (this.state === undefined) throw new RangeError('The game has not started.');
    return this.state;
  }
}

// The bound `Cloneable<TState>` makes `clone()` return `TState`, so the copy needs no cast.
function copy<TState extends Cloneable<TState>>(state: TState): TState {
  return state.clone();
}
