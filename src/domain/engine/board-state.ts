import type { Board } from './board';
import type { Cloneable } from './cloneable';

// The state of one game: its board and its score. Each variant extends it.
// The board changes in place, so `clone()` takes the snapshot (classes.md decision 7).
// `clone()` of a variant state returns that variant state.
// The board takes any axis union, so the state needs no axis type parameter (issue 86).
// A variant state narrows `board` to the board of its own topology.
// `view()` returns plain immutable data for the screen of the variant (classes.md decision 29).
// Each variant state builds it from values that the state holds, and narrows the return type.
// `view()` changes nothing, so a caller can read it at any time.
export interface BoardState<TCell, TCoord> extends Cloneable<BoardState<TCell, TCoord>> {
  readonly board: Board<TCell, TCoord, string>;
  score: number;
  view(): unknown;
}
