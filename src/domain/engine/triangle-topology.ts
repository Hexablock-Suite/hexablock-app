import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import { Turns } from './turns';

// A triangle at (col, row) points up when col + row is even, and down when it is odd.
// It only holds its values. `TriangleTopology` does every calculation.
// Classes.md decision 16: adding two coordinates one component at a time fails here.
export interface TriangleCoord {
  readonly col: number;
  readonly row: number;
}

// Three axes and three directions.
export type TriangleAxis = 'row' | 'down-right' | 'down-left';
export type TriangleDirection = 'left' | 'right' | 'vertical';

// Creates a coordinate. A value that is not a safe integer is an error.
// The object is frozen, because `readonly` holds only at compile time.
export function triangle(col: number, row: number): TriangleCoord {
  if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row)) {
    throw new RangeError(`A triangle coordinate needs whole numbers, not ${col}, ${row}.`);
  }
  // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
  return Object.freeze({ col: 0 + col, row: 0 + row });
}

export function isUp(c: TriangleCoord): boolean {
  return (((c.col + c.row) % 2) + 2) % 2 === 0;
}

// The move of one step depends on the orientation of the triangle.
interface OrientedStep {
  readonly up: TriangleCoord;
  readonly down: TriangleCoord;
}

const left = triangle(-1, 0);
const right = triangle(1, 0);
const above = triangle(0, -1);
const below = triangle(0, 1);

// One step per axis, forward and backward. The `row` axis is a straight strip.
// The two diagonal axes zigzag. A `Map` has no inherited keys,
// so a cast name such as `constructor` finds no step.
const axisSteps: ReadonlyMap<string, { forward: OrientedStep; back: OrientedStep }> = new Map([
  ['row', { forward: { up: right, down: right }, back: { up: left, down: left } }],
  ['down-right', { forward: { up: below, down: right }, back: { up: left, down: above } }],
  ['down-left', { forward: { up: below, down: left }, back: { up: right, down: above } }],
]);

// Each row is a strip of triangles that alternate up and down.
// An up triangle touches the triangles left, right and below it.
// A down triangle touches the triangles left, right and above it.
// The entries have the order of `neighbors()`.
const directionSteps: ReadonlyMap<string, OrientedStep> = new Map([
  ['left', { up: left, down: left }],
  ['right', { up: right, down: right }],
  ['vertical', { up: below, down: above }],
]);

function follow(c: TriangleCoord, step: OrientedStep): TriangleCoord {
  const offset = isUp(c) ? step.up : step.down;
  return triangle(c.col + offset.col, c.row + offset.row);
}

// Rotation uses triangle coordinates (x, y, z): x + y + z is 1 for an up triangle
// and 2 for a down triangle. The lattice cell (i, j) holds the up triangle
// (col 2i + j, row j) = (i, j, 1 - i - j) and the down triangle on its right = (i + 1, j, 1 - i - j).
type Cube = readonly [number, number, number];

function toCube(c: TriangleCoord): Cube {
  const up = isUp(c);
  const j = c.row;
  const i = (c.col - j - (up ? 0 : 1)) / 2;
  return [up ? i : i + 1, j, 1 - i - j];
}

function fromCube([x, y, z]: Cube): TriangleCoord {
  const up = x + y + z === 1;
  const i = up ? x : x - 1;
  return triangle(2 * i + y + (up ? 0 : 1), y);
}

// Strategy (statement §3.3, D4): the real triangle topology. `TriangleGeometry` creates it.
export class TriangleTopology implements GridTopology<
  TriangleCoord,
  TriangleAxis,
  TriangleDirection
> {
  fullTurn(): Turns {
    return Turns.of(6);
  }

  key(c: TriangleCoord): CoordKey {
    return coordKey(`${c.col},${c.row}`);
  }

  neighbors(c: TriangleCoord): TriangleCoord[] {
    return [...directionSteps.values()].map((step) => follow(c, step));
  }

  neighbor(c: TriangleCoord, direction: TriangleDirection): TriangleCoord {
    // The check still runs when a caller casts a free string to a direction.
    const step = directionSteps.get(direction);
    if (step === undefined) {
      throw new RangeError(`The triangle grid has no direction ${direction}.`);
    }
    return follow(c, step);
  }

  directions(): TriangleDirection[] {
    return ['left', 'right', 'vertical'];
  }

  axes(): TriangleAxis[] {
    return ['row', 'down-right', 'down-left'];
  }

  // A sixth of a turn around the origin vertex maps (x, y, z) to (1 - y, 1 - z, 1 - x).
  // Each step changes the orientation of the triangle, so no triangle stays in its place.
  // A caller places a turned piece with `translate()`, as on every other topology.
  rotate(c: TriangleCoord, turns: Turns): TriangleCoord {
    return fromCube(turns.applyTo(toCube(c), ([x, y, z]): Cube => [1 - y, 1 - z, 1 - x], this));
  }

  // The offset counts lattice cells: one step of `col` is two triangles to the right,
  // and one step of `row` is one row down and one triangle to the right.
  // So every translation keeps the orientation of each triangle.
  translate(c: TriangleCoord, offset: TriangleCoord): TriangleCoord {
    return triangle(c.col + 2 * offset.col + offset.row, c.row + offset.row);
  }

  *line(
    axis: TriangleAxis,
    through: TriangleCoord,
    contains: (c: TriangleCoord) => boolean,
  ): Iterable<TriangleCoord> {
    // The check still runs when a caller casts a free string to an axis.
    const steps = axisSteps.get(axis);
    if (steps === undefined) throw new RangeError(`The triangle grid has no axis ${axis}.`);
    let start = through;
    while (contains(follow(start, steps.back))) start = follow(start, steps.back);
    for (let c = start; contains(c); c = follow(c, steps.forward)) yield c;
  }

  // The cells at graph distance `radius`, found breadth first.
  *ring(center: TriangleCoord, { value: radius }: Radius): Iterable<TriangleCoord> {
    let frontier = [center];
    const seen = new Set([this.key(center)]);
    for (let r = 0; r < radius; r += 1) {
      const next: TriangleCoord[] = [];
      for (const c of frontier) {
        for (const n of this.neighbors(c)) {
          if (!seen.has(this.key(n))) {
            seen.add(this.key(n));
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    yield* frontier;
  }

  // A rhombus of `size` × `size` lattice cells, two triangles each.
  region({ value: size }: RegionSize): BoardShape<TriangleCoord> {
    const cells: TriangleCoord[] = [];
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        cells.push(triangle(2 * i + j, j), triangle(2 * i + j + 1, j));
      }
    }
    return BoardShape.of(cells);
  }
}
