import type { BoardState } from '../domain/engine/board-state';
import type { Outcome } from '../domain/engine/outcome';

// The plain response model of the game use cases (classes.md decision 29).
// It holds no `Board` and no engine, so layer 3 cannot change a running game.
// `cells` are new pairs from `Board.cells()`. A cell is an immutable value object.
// `canUndo` and `canRedo` stay false until the engine gets its `MoveHistory` (Sprint 3).
export interface MoveResult<TCell, TCoord> {
  readonly cells: [TCoord, TCell][];
  readonly score: number;
  readonly outcome: Outcome;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

// Builds the response from a snapshot of the engine (`GameEngine.snapshot()`).
export function moveResultOf<TCell, TCoord>(
  snapshot: BoardState<TCell, TCoord>,
  outcome: Outcome,
): MoveResult<TCell, TCoord> {
  return {
    cells: snapshot.board.cells(),
    score: snapshot.score,
    outcome,
    canUndo: false,
    canRedo: false,
  };
}
