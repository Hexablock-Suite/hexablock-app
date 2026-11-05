import type { Board } from './board';
import type { Cloneable } from './cloneable';

// The state of one game: its board and its score. Each variant extends it.
// The board changes in place, so `clone()` takes the snapshot (classes.md decision 7).
// `clone()` of a variant state returns that variant state.
export interface BoardState<TCell, TCoord> extends Cloneable<BoardState<TCell, TCoord>> {
  readonly board: Board<TCell, TCoord>;
  score: number;
}
