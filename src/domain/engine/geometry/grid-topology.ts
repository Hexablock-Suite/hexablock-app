import type { BoardShape } from './board-shape';
import type { CoordKey } from './coord-key';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import type { Turns } from './turns';

// An axis of one topology: a line of cells that a board walks, such as a row.
// It is a value object with a closed set of instances (classes.md decision 45, issue #207).
// Each topology has its own axis class, which also steps along the axis from a cell.
// The engine reads only `equals()`, so this interface names no coordinate.
export interface GridAxis {
  equals(other: GridAxis): boolean;
}

// Strategy (statement §3.3, D4). The engine asks the topology for every coordinate calculation,
// so one board serves hexagons, triangles and squares (classes.md decision 16).
// `TCoord` has no bound, so no engine code reads or adds the values of a coordinate itself.
// A coordinate is a value object that does the calculations on its own values (decision 44).
// The topology does what belongs to the grid: the neighbors, the lines, the rings and the regions.
// Each topology declares its axes as a class with a closed set of instances,
// for example `HexAxis.q`, `HexAxis.r` and `HexAxis.s` (decision 45, issue #207).
// So the compiler rejects a text, and it rejects an axis of another topology.
// A cast such as `'nort' as unknown as SquareAxis` passes the compiler.
// So each topology checks the axis in `line()` at runtime.
// A value that is not an axis of the topology is a `RangeError`.
// The topology names no direction (issue #416). A slide is an axis and a sense,
// and each topology keeps its directions private for `neighbors()`.
// `TAxis` defaults to its bound. So `GridTopology<TCoord>` is a topology with any axis,
// for a caller that reads no axis.
export interface GridTopology<TCoord, TAxis extends GridAxis = GridAxis> {
  // One full turn: 6 rotation steps for a hexagon, 4 for a square.
  fullTurn(): Turns;
  // A unique key for a coordinate. The board stores its cells by this key.
  key(c: TCoord): CoordKey;
  // The cells that share a side with `c`, in the order of the topology.
  neighbors(c: TCoord): TCoord[];
  axes(): TAxis[];
  rotate(c: TCoord, turns: Turns): TCoord;
  translate(c: TCoord, offset: TCoord): TCoord;
  // The offset that translates `from` to `to`, if translation can reach `to`.
  translationOffset(from: TCoord, to: TCoord): TCoord | undefined;
  // The coordinates on one axis through `through`, in order, while `contains` is true.
  line(axis: TAxis, through: TCoord, contains: (c: TCoord) => boolean): Iterable<TCoord>;
  // The coordinates at distance `radius` from `center`. Radius 0 gives the center.
  ring(center: TCoord, radius: Radius): Iterable<TCoord>;
  region(size: RegionSize): BoardShape<TCoord>;
}
