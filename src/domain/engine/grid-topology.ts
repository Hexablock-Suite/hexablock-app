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

// A direction of one topology: the way from a cell to one of its neighbors.
// It is a value object with a closed set of instances, as an axis is.
// Each topology has its own direction class, which also gives the neighbor of a cell.
export interface GridDirection {
  equals(other: GridDirection): boolean;
}

// Strategy (statement §3.3, D4). The engine asks the topology for every coordinate calculation,
// so one board serves hexagons, triangles and squares (classes.md decision 16).
// `TCoord` has no bound, so no engine code reads or adds the values of a coordinate itself.
// A coordinate is a value object that does the calculations on its own values (decision 44).
// The topology does what belongs to the grid: the neighbors, the lines, the rings and the regions.
// Each topology declares its axes and its directions as two classes with a closed set
// of instances, for example `HexAxis.q`, `HexAxis.r` and `HexAxis.s` (decision 45, issue #207).
// So the compiler rejects a text, and it rejects an axis of another topology.
// A cast such as `'nort' as unknown as SquareAxis` passes the compiler.
// So each topology checks the axis in `line()` and the direction in `neighbor()` at runtime.
// A value that is not an axis or a direction of the topology is a `RangeError`.
// The two parameters default to their bounds. So `GridTopology<TCoord>` is a topology
// with any axis and any direction, for a caller that reads neither.
export interface GridTopology<
  TCoord,
  TAxis extends GridAxis = GridAxis,
  TDirection extends GridDirection = GridDirection,
> {
  // One full turn: 6 rotation steps for a hexagon, 4 for a square.
  fullTurn(): Turns;
  // A unique key for a coordinate. The board stores its cells by this key.
  key(c: TCoord): CoordKey;
  neighbors(c: TCoord): TCoord[];
  // The neighbor of `c` in one direction. `neighbors()` holds one cell per direction.
  neighbor(c: TCoord, direction: TDirection): TCoord;
  directions(): TDirection[];
  axes(): TAxis[];
  rotate(c: TCoord, turns: Turns): TCoord;
  translate(c: TCoord, offset: TCoord): TCoord;
  // The coordinates on one axis through `through`, in order, while `contains` is true.
  line(axis: TAxis, through: TCoord, contains: (c: TCoord) => boolean): Iterable<TCoord>;
  // The coordinates at distance `radius` from `center`. Radius 0 gives the center.
  ring(center: TCoord, radius: Radius): Iterable<TCoord>;
  region(size: RegionSize): BoardShape<TCoord>;
}
