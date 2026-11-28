import type { BoardSnapshot, BoardState, SnapshotOf } from '../domain/engine/board/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { ElapsedTime } from '../domain/shared/elapsed-time';
import type { GameEngine } from '../domain/engine/turn/game-engine';
import type { LevelId } from '../domain/progress/level-id';
import type { Moves } from '../domain/shared/moves';
import type { Outcome } from '../domain/engine/events/outcome';
import type { Score } from '../domain/shared/score';
import type { UseCaseError } from './result';

// The data that a state gives to the screen of its variant: the return type of `view()`
// on the photo of the state. The use cases read it through the type of the state,
// so they never name a variant.
export type ViewOf<TState> = SnapshotOf<TState> extends { view(): infer TView } ? TView : never;

// The plain response model of the game use cases (classes.md decision 29).
// It holds no `Board` and no engine, so layer 3 cannot change a running game.
// `cells` are new pairs from `Board.occupiedCells()`. A cell is an immutable value object.
// `freeSpaces` is a new list from `Board.freeSpaces()`: the coordinate of each space that no cell
// occupies. So `cells` and `freeSpaces` name each space of the board once, and a game screen
// draws the whole board (issue #170).
// `score` carries the `Score` value object of the photo. A use case never opens a domain object:
// the presenter of layer 3 asks the score for its number (issue #203).
// `outcome` carries the `Outcome` value object of the turn, by the same rule (issue #207).
// `canUndo` and `canRedo` ask the root (decision 27).
// `hasUndo` says whether the variant has undo at all: it asks `offersUndo()` of the root.
// A false `canUndo` alone cannot separate «no undo» from «undo used».
// `payload` is the variant data of the `view()` of the photo, typed by the state.
// The view keeps its fields private (issue #245). The use case reads nothing of it,
// and an adapter of the edge receives its data with `deliverTo()`.
// `TView` defaults to `unknown`, so a signature that does not read the payload need not name it.
// `elapsedMs` exists only for a timed game. It asks the root for the time of play
// when the response is built.
// It carries the `ElapsedTime` value object of the timer, by the same rule as `score` (issue #204).
// `moves` exists only for a game that counts its moves, Fit and Sort: it asks the photo
// for `moveCount()` (D26, decision 61). `levelId` exists only for a game that started at a level:
// it asks the root for `levelOfMatch()`. Both are value objects that no use case opens.
// The result presenter builds the saved `GameResult` from them (#180).
// `failedDeliveries` exists only when the publisher refused an event of the turn (issue #342).
// It holds one `publish-failed` `UseCaseError` per refused event. The turn is saved all the same,
// so the call is a success (decision 29). `logEntryOf()` copies the list into the log entry.
export interface MoveResult<TCell, TCoord, TView = unknown> {
  readonly cells: [TCoord, TCell][];
  readonly freeSpaces: TCoord[];
  readonly score: Score;
  readonly outcome: Outcome;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasUndo: boolean;
  readonly payload: TView;
  readonly elapsedMs?: ElapsedTime;
  readonly moves?: Moves;
  readonly levelId?: LevelId;
  readonly failedDeliveries?: readonly UseCaseError[];
}

// Builds the response from the engine: the photo of the state and the queries of the root.
// It asks only the photo (classes.md decisions 7 and 34) and the root, never a field of the state
// and never a part of the aggregate, so the use cases stay blind to the variant (issue #234).
// TypeScript cannot resolve `SnapshotOf<TState>` and `ViewOf<TState>` for an open `TState`.
// Every photo is a `BoardSnapshot`, so the photo and the payload need a cast.
export function moveResultOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(
  engine: GameEngine<TCell, TCoord, TMove, TState>,
  outcome: Outcome,
): MoveResult<TCell, TCoord, ViewOf<TState>> {
  const snapshot = engine.snapshot() as BoardSnapshot<TCell, TCoord> & SnapshotOf<TState>;
  const elapsed = engine.elapsedTime();
  const moves = snapshot.moveCount();
  const levelId = engine.levelOfMatch();
  return {
    cells: snapshot.boardCopy().occupiedCells(),
    freeSpaces: snapshot.boardCopy().freeSpaces(),
    score: snapshot.scoreSoFar(),
    outcome,
    canUndo: engine.canUndo(),
    canRedo: engine.canRedo(),
    hasUndo: engine.offersUndo(),
    payload: snapshot.view() as ViewOf<TState>,
    ...(elapsed === undefined ? {} : { elapsedMs: elapsed }),
    ...(moves === undefined ? {} : { moves }),
    ...(levelId === undefined ? {} : { levelId }),
  };
}
