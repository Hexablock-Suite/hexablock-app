import type { Board } from './board';
import type { Cloneable } from './cloneable';

// The state of one game: its board and its score. Each variant extends it.
// The state is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// It changes only through its own methods, which have business names.
// The rules call them, and the engine calls `addPoints()`. No other class writes a field.
// `score` stays readable for the scoring policies and the use cases.
// `addPoints()` adds the points of one turn. Points that are not finite throw a RangeError,
// and the score stays as it was.
// The board changes in place, so `clone()` takes the snapshot (classes.md decision 7).
// `clone()` of a variant state returns that variant state.
// The board takes any axis union, so the state needs no axis type parameter (issue 86).
// A variant state narrows `board` to the board of its own topology.
// `view()` returns plain immutable data for the screen of the variant (classes.md decision 29).
// Each variant state builds it from values that the state holds, and narrows the return type.
// `view()` changes nothing, so a caller can read it at any time.
export interface BoardState<TCell, TCoord> extends Cloneable<BoardState<TCell, TCoord>> {
  readonly board: Board<TCell, TCoord, string>;
  readonly score: number;
  addPoints(points: number): void;
  view(): unknown;
}
