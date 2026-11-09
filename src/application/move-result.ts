import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameEngine } from '../domain/engine/game-engine';
import type { Outcome } from '../domain/engine/outcome';

// The data that a state gives to the screen of its variant: the return type of `view()`.
// The use cases read it through the type of the state, so they never name a variant.
export type ViewOf<TState> = TState extends { view(): infer TView } ? TView : never;

// The plain response model of the game use cases (classes.md decision 29).
// It holds no `Board` and no engine, so layer 3 cannot change a running game.
// `cells` are new pairs from `Board.cells()`. A cell is an immutable value object.
// `canUndo` and `canRedo` read the capabilities of the engine (decision 27).
// `hasUndo` says whether the variant has undo at all. A false `canUndo` alone cannot
// separate «no undo» from «undo used».
// `payload` is the variant data of `BoardState.view()`, typed by the state.
// `TView` defaults to `unknown`, so a signature that does not read the payload need not name it.
export interface MoveResult<TCell, TCoord, TView = unknown> {
  readonly cells: [TCoord, TCell][];
  readonly score: number;
  readonly outcome: Outcome;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasUndo: boolean;
  readonly payload: TView;
}

// Builds the response from the engine: a snapshot and its undo capabilities.
// It only reads the engine, so the use cases stay blind to the variant.
// TypeScript cannot resolve `ViewOf<TState>` for an open `TState`, so the payload needs a cast.
export function moveResultOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(
  engine: GameEngine<TCell, TCoord, TMove, TState>,
  outcome: Outcome,
): MoveResult<TCell, TCoord, ViewOf<TState>> {
  const snapshot = engine.snapshot();
  const undoable = engine.undoable();
  return {
    cells: snapshot.board.cells(),
    score: snapshot.score,
    outcome,
    canUndo: undoable?.canUndo() ?? false,
    canRedo: engine.redoable()?.canRedo() ?? false,
    hasUndo: undoable !== undefined,
    payload: snapshot.view() as ViewOf<TState>,
  };
}
