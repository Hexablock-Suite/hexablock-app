import type { BoardShape } from './board-shape';
import type { CoordKey } from './coord-key';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import type { Turns } from './turns';

// Strategy (statement §3.3, D4). The topology does every coordinate calculation,
// so one board serves hexagons, triangles and squares (classes.md decision 16).
// A coordinate only holds its values. No engine code adds two coordinates itself.
// Each topology declares its axes and its directions as closed unions of names,
// for example `'q' | 'r' | 's'`. So the compiler rejects an axis that the topology lacks.
// A cast such as `'nort' as SquareAxis` passes the compiler.
// So each topology checks the axis in `line()` at runtime and throws a `RangeError`.
// No method takes a direction, so a topology has no direction to check.
export interface GridTopology<TCoord, TAxis extends string, TDirection extends string> {
  // The number of rotation steps of a full turn: 6 for a hexagon, 4 for a square.
  readonly rotationSteps: number;
  // A unique key for a coordinate. The board stores its cells by this key.
  key(c: TCoord): CoordKey;
  neighbors(c: TCoord): TCoord[];
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
