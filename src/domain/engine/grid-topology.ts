import type { BoardShape } from './board-shape';

// The name of one axis of a grid, for example `q` on a hexagonal grid.
export type Axis = string;

// The name of one direction of a grid, for example `north-east`.
export type Direction = string;

// Strategy (statement §3.3, D4). The topology does every coordinate calculation,
// so one board serves hexagons, triangles and squares (classes.md decision 16).
// A coordinate only holds its values. No engine code adds two coordinates itself.
export interface GridTopology<TCoord> {
  // The number of rotation steps of a full turn: 6 for a hexagon, 4 for a square.
  readonly rotationSteps: number;
  // A unique text for a coordinate. The board stores its cells by this key.
  key(c: TCoord): string;
  neighbors(c: TCoord): TCoord[];
  directions(): Direction[];
  axes(): Axis[];
  rotate(c: TCoord, steps: number): TCoord;
  translate(c: TCoord, offset: TCoord): TCoord;
  // The coordinates on one axis through `through`, in order, while `contains` is true.
  line(axis: Axis, through: TCoord, contains: (c: TCoord) => boolean): Iterable<TCoord>;
  // The coordinates at distance `radius` from `center`. Radius 0 gives the center.
  ring(center: TCoord, radius: number): Iterable<TCoord>;
  region(size: number): BoardShape<TCoord>;
}
