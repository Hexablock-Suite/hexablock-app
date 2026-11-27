import type { BoardSnapshot, BoardState, SnapshotOf } from './board-state';
import type { Cloneable } from './cloneable';
import type { ElapsedTime } from '../shared/elapsed-time';
import { GameOver, type GameEvent } from './game-events';
import type { GameId } from '../shared/game-id';
import { PlayingPhase, ResolvingPhase, type GamePhase } from './game-phase';
import type { MatchId } from './match-id';
import { MoveCommand } from './move-command';
import type { Outcome } from './outcome';
import { Resolution } from './resolution';
import type { IGameRules } from './rules';
import type { IScoringPolicy } from './scoring-policy';
import type { ITimed } from './timed';
import type { IRedoable, IUndoable } from './undo-capabilities';

// The aggregate root of one game (classes.md decision 26).
// It is an entity: its `MatchId` is its identity, and the id never changes.
// `GameFactory` gives each new game the id of a generator. `gameId` only names the variant.
// A game changes only through `tryPlay()`, `undo()` and `redo()`, and each acts only
// while `currentPhase().canPlay()` is true. `snapshot()` returns the photo of the state,
// which is immutable, so no caller changes the game through it (classes.md decision 34).
// The engine depends only on the interfaces of the rules and the scoring (Strategy, D1).
// `TState` is a `BoardState` whose `clone()` returns `TState`, so each copy keeps the state type.
// `history` and `timer` are optional parts, because the variant factory decides them
// (classes.md decisions 3 and 19). The root is their only door (classes.md decisions 27 and 52):
// a caller asks `undo()`, `redo()`, `canUndo()`, `canRedo()`, `offersUndo()` and `elapsedTime()`,
// and the root hands out neither part (issue #234). `GameFactory` gives the same timer
// to the root and to the `TimedRulesDecorator` that starts and stops it.
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
    private readonly history?: IUndoable<TMove, SnapshotOf<TState>>,
    private readonly timer?: ITimed,
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

  // Takes back the last saved move (classes.md decisions 27 and 34).
  // A game with no history throws a RangeError. A history with no move to undo throws one too,
  // and so does a phase that accepts no undo. Each refusal leaves the game as it was.
  undo(): void {
    if (this.history === undefined) throw new RangeError('The game offers no undo.');
    this.history.undo();
  }

  // Plays the last undone move again: the state takes back the photo after that move.
  // A history that cannot redo throws a RangeError, and so does a history with no undone move
  // and a phase that accepts no undo. Each refusal leaves the game as it was.
  // Only `RedoableHistory` redoes (#178).
  redo(): void {
    this.redoCapability().redo();
  }

  // True when the game has a saved move to take back.
  canUndo(): boolean {
    return this.history?.canUndo() ?? false;
  }

  // True when the game has an undone move to play again.
  canRedo(): boolean {
    return this.history?.redoable()?.canRedo() ?? false;
  }

  // True when the variant offers undo at all. A false `canUndo()` cannot tell «no undo»
  // from «undo used», so `UndoMove` and `MoveResult.hasUndo` ask this query.
  offersUndo(): boolean {
    return this.history !== undefined;
  }

  // The time of play of a timed game, or `undefined` for a game with no timer
  // (classes.md decisions 19 and 27). So `MoveResult.elapsedMs` exists only for a timed game.
  elapsedTime(): ElapsedTime | undefined {
    return this.timer?.elapsedMs();
  }

  // One turn: receive the move, let the rules validate, apply, resolve and evaluate it
  // (template method `playTurn()`), score it, record the events of the move, and record
  // `GameOver` when the game ends. It is the one entry of a turn (classes.md decision 26,
  // issue #415): `ApplyMove` calls it.
  // It returns the `Resolution` of the turn, which also says
  // whether the rules accepted the move. So the `ApplyMove` use case can return a failure
  // for a rejected move (issue 100). A rejected move always has the outcome `playing`.
  // An accepted turn records the events of its move, which the photo after the move gives
  // (issue #361). A turn that ends the game also records one `GameOver` event, after them,
  // when the engine saves the turn (classes.md decision 29). A rejected move records no event. The engine builds the event inside the turn, so an error there
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
    this.remember(move, turn.before, turn.after);
    this.recorded.push(...turn.events);
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
  // `before` and `after` are the Mementos: the photos of the state before and after the move,
  // points included (classes.md decision 34, issue #178). They are taken inside the turn,
  // so a photo that throws leaves the turn unsaved.
  // `events` are the events of the turn, in their order: the events of the move that the photo
  // after the move gives (issue #361), then the `GameOver` of a turn that ends the game.
  // The root builds each event with its own ids. It reads no variant event by name.
  private resolveTurn(
    state: TState,
    move: TMove,
  ):
    | {
        next: TState;
        phase: GamePhase;
        outcome: Outcome;
        before: SnapshotOf<TState>;
        after: SnapshotOf<TState>;
        events: readonly GameEvent[];
      }
    | undefined {
    const next = copy(state);
    const resolution = this.rules.playTurn(next, move);
    if (!resolution.wasAccepted()) return undefined;
    const before = photoOf(state);
    next.addPoints(this.scoring.score(before, photoOf(next)));
    const after = photoOf(next);
    const phase = resolution.phaseAfter(this.current);
    const ended = this.gameOverOf(next, resolution);
    return {
      next,
      phase,
      outcome: resolution.leadsTo(),
      before,
      after,
      events: [
        ...after.eventsOfLastMove(this.gameId, this.matchId),
        ...(ended === undefined ? [] : [ended]),
      ],
    };
  }

  // The event of a turn that ends the game, with the final score of `next`.
  // It is `undefined` while the game goes on.
  private gameOverOf(next: TState, resolution: Resolution): GameOver | undefined {
    if (!resolution.endsTheGame()) return undefined;
    return new GameOver(
      this.gameId,
      this.matchId,
      resolution.leadsTo(),
      photoOf(next).scoreSoFar(),
    );
  }

  // Keeps the undo and the redo of a saved turn. A finished game forgets its moves: the game
  // over event is already recorded, and an undo cannot take it back. The check reads the new
  // phase. A variant with no history keeps no command.
  private remember(move: TMove, before: SnapshotOf<TState>, after: SnapshotOf<TState>): void {
    if (this.current.canPlay()) {
      this.history?.record(
        new MoveCommand<TMove, SnapshotOf<TState>>(move, before, after, (memento) =>
          this.restore(memento),
        ),
      );
    } else {
      this.history?.clear();
    }
  }

  // The receiver of an undo and of a redo (issue 159, classes.md decision 34).
  // `MoveCommand.undo()` and `MoveCommand.redo()` call it. A paused game refuses both.
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

  // The redo capability of the history. A game whose history cannot redo throws a RangeError.
  private redoCapability(): IRedoable {
    const redoable = this.history?.redoable();
    if (redoable === undefined) throw new RangeError('The game offers no redo.');
    return redoable;
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
