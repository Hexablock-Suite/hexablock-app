import type { BoardSnapshot, BoardState, SnapshotOf } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { ElapsedTime } from '../domain/engine/elapsed-time';
import type { GameEngine } from '../domain/engine/game-engine';
import type { Outcome } from '../domain/engine/outcome';
import type { Score } from '../domain/engine/score';

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
  };
}
