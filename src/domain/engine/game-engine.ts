import type { BoardSnapshot, BoardState, SnapshotOf } from './board-state';
import type { Cloneable } from './cloneable';
import { GameOver, type GameEvent } from './game-events';
import type { GameId } from './game-id';
import { PlayingPhase, ResolvingPhase, type GamePhase } from './game-phase';
import type { MatchId } from './match-id';
import { MoveCommand } from './move-command';
import type { MoveHistory } from './move-history';
import type { Outcome } from './outcome';
import { Resolution } from './resolution';
import type { IGameRules } from './rules';
import type { IScoringPolicy } from './scoring-policy';
import type { ITimed } from './timed';
import type { IRedoable, IUndoable } from './undo-capabilities';

// The aggregate root of one game (classes.md decision 26).
// It is an entity: its `MatchId` is its identity, and the id never changes.
// `GameFactory` gives each new game the id of a generator. `gameId` only names the variant.
// A game changes only through `play()` and through the undo capability, and both act only
// while `currentPhase().canPlay()` is true. `snapshot()` returns the photo of the state,
// which is immutable, so no caller changes the game through it (classes.md decision 34).
// The engine depends only on the interfaces of the rules and the scoring (Strategy, D1).
// `TState` is a `BoardState` whose `clone()` returns `TState`, so each copy keeps the state type.
// `history` is optional, because the variant factory decides it (classes.md decision 3).
// The engine is the Memento originator (decision 34). Each saved turn keeps the photo of the
// state before the move, and `restore()` gives that photo back to the state.
// The root only records its events, and it tells nobody (classes.md decision 52).
// `ApplyMove` takes them with `takeEvents()` after the turn and delivers them (decision 29).
export class GameEngine<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  private state: TState | undefined;
  private current: GamePhase = PlayingPhase.instance;
  // The events of the saved turns that no caller has taken yet, in their order.
  private readonly recorded: GameEvent[] = [];

  constructor(
    private readonly matchId: MatchId,
    private readonly gameId: GameId,
    private readonly rules: IGameRules<TMove, TState>,
    private readonly scoring: IScoringPolicy<TState>,
    private readonly history?: MoveHistory<TMove, SnapshotOf<TState>>,
  ) {}

  // Two engines are the same game when they have the same `MatchId`.
  // The boards, the scores and the phases do not count.
  equals(other: GameEngine<TCell, TCoord, TMove, TState>): boolean {
    return this.matchId.equals(other.matchId);
  }

  // Tells which phase the game is in.
  currentPhase(): GamePhase {
    return this.current;
  }

  // Starts a game from a copy of `initial`, so the caller keeps no reference to the board.
  // A new game has no move to undo.
  // The state is an entity inside this aggregate, and its identity is the `MatchId` of the game.
  // A state of another match throws a RangeError, and the game stays as it was.
  start(initial: TState): void {
    if (!initial.belongsTo(this.matchId)) {
      throw new RangeError('The first state belongs to another match.');
    }
    this.state = copy(initial);
    this.current = PlayingPhase.instance;
    this.history?.clear();
  }

  // The undo capability that the variant factory gave, or `undefined` (classes.md decision 27).
  undoable(): IUndoable | undefined {
    return this.history;
  }

  // The redo capability of the history, or `undefined`.
  redoable(): IRedoable | undefined {
    return this.history?.redoable();
  }

  // The timer of the rules, or `undefined` for a game with no timer (classes.md decision 27).
  timed(): ITimed | undefined {
    return this.rules.timed();
  }

  // One turn: receive the move, let the rules validate, apply, resolve and evaluate it
  // (template method `playTurn()`), score it, and record `GameOver` when the game ends.
  // A rejected move returns `playing`. Call `tryPlay()` to tell it from an accepted move.
  play(move: TMove): Outcome {
    return this.tryPlay(move).outcome;
  }

  // The same turn as `play()`. It returns the `Resolution` of the turn, which also says
  // whether the rules accepted the move. So the `ApplyMove` use case can return a failure
  // for a rejected move (issue 100). A rejected move always has the outcome `playing`.
  // A turn that ends the game records one `GameOver` event when the engine saves the turn
  // (classes.md decision 29). The engine builds the event inside the turn, so an error there
  // leaves the turn unsaved. The engine calls no publisher, so no publisher failure reaches
  // the turn (issue #233).
  // The rollback covers the whole state and the phase. A piece source lives in the state
  // (classes.md decision 31), and a draw replaces it only in the copy of the turn
  // (classes.md decision 51). So a turn that throws after a draw leaves the source
  // at its old position, and a retry draws the same piece.
  // The rules change their copy in place (classes.md decision 7), and a `Resolution` holds
  // no state. So the engine keeps the copy that it gave to the rules as the next state.
  tryPlay(move: TMove): Resolution {
    const state = this.started();
    this.current.checkAcceptsMove();
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
      return Resolution.rejected();
    }
    this.state = turn.next;
    this.current = turn.phase;
    this.remember(move, turn.before);
    if (turn.ended !== undefined) this.recorded.push(turn.ended);
    // The engine builds the resolution, so the caller gets a real `Resolution` from any rules.
    return Resolution.resolved().evaluated(turn.outcome);
  }

  // The events that the game recorded since the last call, in their order.
  // The game forgets them, so a second call never gives an event again.
  // `ApplyMove` calls it after each turn and delivers the events (classes.md decision 29).
  takeEvents(): readonly GameEvent[] {
    return this.recorded.splice(0);
  }

  pause(): void {
    this.started();
    this.current = this.current.pause();
  }

  resume(): void {
    this.current = this.current.resume();
  }

  // The photo of the state now. It is immutable and holds a copy of the board,
  // so a later move never changes it, and a change to it never changes the game.
  snapshot(): SnapshotOf<TState> {
    return photoOf(this.started());
  }

  // Runs the rules and the scoring, and computes the next phase. It changes no engine field.
  // It returns `undefined` for a rejected move.
  // The rules play on a copy of the state. The scoring reads the photo before the move
  // and the photo of the copy after the rules. The copy then takes the points.
  // The points are a `Score`. A policy that gives no valid score throws, and so does a total
  // above the largest safe integer. Both leave the turn unsaved (classes.md decision 41).
  // `before` is the Memento: the photo of the state before the move (classes.md decision 34).
  // It is taken inside the turn, so a photo that throws leaves the turn unsaved.
  // `ended` is the `GameOver` event of a turn that ends the game, or `undefined`.
  private resolveTurn(
    state: TState,
    move: TMove,
  ):
    | {
        next: TState;
        phase: GamePhase;
        outcome: Outcome;
        before: SnapshotOf<TState>;
        ended: GameOver | undefined;
      }
    | undefined {
    const next = copy(state);
    const resolution = this.rules.playTurn(next, move);
    if (!resolution.accepted) return undefined;
    const before = photoOf(state);
    next.addPoints(this.scoring.score(before, photoOf(next)));
    const phase = this.current.after(resolution.outcome);
    return {
      next,
      phase,
      outcome: resolution.outcome,
      before,
      ended: this.gameOverOf(next, resolution.outcome),
    };
  }

  // The event of a turn that ends the game, with the final score of `next`.
  // It is `undefined` while the game goes on.
  private gameOverOf(next: TState, outcome: Outcome): GameOver | undefined {
    if (!outcome.endsTheGame()) return undefined;
    return new GameOver(this.gameId, this.matchId, outcome, photoOf(next).score);
  }

  // Keeps the undo of a saved turn. A finished game forgets its moves: the game over event
  // is already recorded, and an undo cannot take it back. The check reads the new phase.
  // A variant with no history keeps no command.
  private remember(move: TMove, before: SnapshotOf<TState>): void {
    if (this.current.canPlay()) {
      this.history?.record(
        new MoveCommand<TMove, SnapshotOf<TState>>(move, before, (memento) =>
          this.restore(memento),
        ),
      );
    } else {
      this.history?.clear();
    }
  }

  // The receiver of an undo (issue 159, classes.md decision 34). `MoveCommand.undo()` calls it.
  // It is private and reaches a command only as a function, so no caller can write the state.
  // The state takes its photo back in place. The photo is immutable, so it needs no copy.
  private restore(memento: SnapshotOf<TState>): void {
    this.current.checkAcceptsUndo();
    this.started().restore(memento);
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

// The photo of a state with the type of its variant. The bound of `TState` gives
// `snapshot()` the return type `BoardSnapshot`, and a variant state narrows it.
// TypeScript cannot resolve `SnapshotOf<TState>` for an open `TState`, so the photo needs a cast.
function photoOf<TCell, TCoord, TState extends BoardState<TCell, TCoord>>(
  state: TState,
): BoardSnapshot<TCell, TCoord> & SnapshotOf<TState> {
  return state.snapshot() as BoardSnapshot<TCell, TCoord> & SnapshotOf<TState>;
}
