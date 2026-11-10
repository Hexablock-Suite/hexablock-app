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
// `cells` are new pairs from `Board.cells()`. A cell is an immutable value object.
// `score` carries the `Score` value object of the photo. A use case never opens a domain object:
// the presenter of layer 3 asks the score for its number (issue #203).
// `outcome` carries the `Outcome` value object of the turn, by the same rule (issue #207).
// `canUndo` and `canRedo` read the capabilities of the engine (decision 27).
// `hasUndo` says whether the variant has undo at all. A false `canUndo` alone cannot
// separate «no undo» from «undo used».
// `payload` is the variant data of the `view()` of the photo, typed by the state.
// `TView` defaults to `unknown`, so a signature that does not read the payload need not name it.
// `elapsedMs` exists only for a timed game. It reads the timer when the response is built.
// It carries the `ElapsedTime` value object of the timer, by the same rule as `score` (issue #204).
export interface MoveResult<TCell, TCoord, TView = unknown> {
  readonly cells: [TCoord, TCell][];
  readonly score: Score;
  readonly outcome: Outcome;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasUndo: boolean;
  readonly payload: TView;
  readonly elapsedMs?: ElapsedTime;
}

// Builds the response from the engine: the photo of the state and the undo capabilities.
// It reads only the photo (classes.md decision 34) and the engine, never a field of the state,
// so the use cases stay blind to the variant.
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
  const undoable = engine.undoable();
  const timed = engine.timed();
  return {
    cells: snapshot.board.cells(),
    score: snapshot.score,
    outcome,
    canUndo: undoable?.canUndo() ?? false,
    canRedo: engine.redoable()?.canRedo() ?? false,
    hasUndo: undoable !== undefined,
    payload: snapshot.view() as ViewOf<TState>,
    ...(timed === undefined ? {} : { elapsedMs: timed.elapsedMs() }),
  };
}
