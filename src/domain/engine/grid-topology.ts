import type { BoardShape } from './board-shape';
import type { CoordKey } from './coord-key';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import type { Turns } from './turns';

// Strategy (statement §3.3, D4). The engine asks the topology for every coordinate calculation,
// so one board serves hexagons, triangles and squares (classes.md decision 16).
// `TCoord` has no bound, so no engine code reads or adds the values of a coordinate itself.
// A coordinate is a value object that does the calculations on its own values (decision 44).
// The topology does what belongs to the grid: the neighbors, the lines, the rings and the regions.
// Each topology declares its axes and its directions as closed unions of names,
// for example `'q' | 'r' | 's'`. So the compiler rejects an axis that the topology lacks.
// A cast such as `'nort' as SquareAxis` passes the compiler.
// So each topology checks the axis in `line()` and the direction in `neighbor()` at runtime.
// A name that the topology lacks is a `RangeError`.
export interface GridTopology<TCoord, TAxis extends string, TDirection extends string> {
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
