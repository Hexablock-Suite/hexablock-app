import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import { Turns } from './turns';

// Rotation uses triangle coordinates (x, y, z): x + y + z is 1 for an up triangle
// and 2 for a down triangle. The lattice cell (i, j) holds the up triangle
// (col 2i + j, row j) = (i, j, 1 - i - j) and the down triangle on its right = (i + 1, j, 1 - i - j).
type Cube = readonly [number, number, number];

// A triangle at (col, row) points up when col + row is even, and down when it is odd.
// It is a value object (classes.md decisions 16 and 44, issue #206): it never changes,
// and two coordinates are equal when their values are equal.
// The values are private. The coordinate does every calculation on its own values.
// `TriangleTopology` does what belongs to the grid: the neighbors, the lines, the rings and the regions.
// Its operations are not the ones of a hexagon. It has no sum of one value at a time,
// because that sum flips the orientation when the offset is odd (classes.md decision 16).
export class TriangleCoord {
  private constructor(
    private readonly col: number,
    private readonly row: number,
  ) {
    // The object is frozen, because `private` and `readonly` hold only at compile time.
    Object.freeze(this);
  }

  // Creates a coordinate. A value that is not a safe integer is an error.
  static of(col: number, row: number): TriangleCoord {
    if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row)) {
      throw new RangeError(`A triangle coordinate needs whole numbers, not ${col}, ${row}.`);
    }
    // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
    return new TriangleCoord(0 + col, 0 + row);
  }

  // Two coordinates are equal when they hold the same values.
  equals(other: TriangleCoord): boolean {
    return this.col === other.col && this.row === other.row;
  }

  // Tells if the triangle points up.
  isUp(): boolean {
    return (((this.col + this.row) % 2) + 2) % 2 === 0;
  }

  // The triangle on the left in the same row. Its orientation is the other one.
  left(): TriangleCoord {
    return TriangleCoord.of(this.col - 1, this.row);
  }

  // The triangle on the right in the same row. Its orientation is the other one.
  right(): TriangleCoord {
    return TriangleCoord.of(this.col + 1, this.row);
  }

  // The triangle in the row above. Its orientation is the other one.
  above(): TriangleCoord {
    return TriangleCoord.of(this.col, this.row - 1);
  }

  // The triangle in the row below. Its orientation is the other one.
  below(): TriangleCoord {
    return TriangleCoord.of(this.col, this.row + 1);
  }

  // This coordinate moved by an offset. The offset counts lattice cells:
  // one step of `col` is two triangles to the right,
  // and one step of `row` is one row down and one triangle to the right.
  // So every translation keeps the orientation of the triangle.
  translated(offset: TriangleCoord): TriangleCoord {
    return TriangleCoord.of(this.col + 2 * offset.col + offset.row, this.row + offset.row);
  }

  // This coordinate after a sixth of a turn around the origin vertex:
  // (x, y, z) becomes (1 - y, 1 - z, 1 - x).
  // The step changes the orientation of the triangle, so no triangle stays in its place.
  turned(): TriangleCoord {
    const [x, y, z] = this.toCube();
    return TriangleCoord.fromCube([1 - y, 1 - z, 1 - x]);
  }

  // The text of the coordinate: `col,row`. `TriangleTopology` brands it as its key.
  toString(): string {
    return `${this.col},${this.row}`;
  }

  private toCube(): Cube {
    const up = this.isUp();
    const j = this.row;
    const i = (this.col - j - (up ? 0 : 1)) / 2;
    return [up ? i : i + 1, j, 1 - i - j];
  }

  private static fromCube([x, y, z]: Cube): TriangleCoord {
    const up = x + y + z === 1;
    const i = up ? x : x - 1;
    return TriangleCoord.of(2 * i + y + (up ? 0 : 1), y);
  }
}

// Three axes and three directions.
export type TriangleAxis = 'row' | 'down-right' | 'down-left';
export type TriangleDirection = 'left' | 'right' | 'vertical';

// Creates a coordinate. It is the short name of `TriangleCoord.of()`, which checks the values.
export function triangle(col: number, row: number): TriangleCoord {
  return TriangleCoord.of(col, row);
}

// Tells if a triangle points up. It is the short name of `TriangleCoord.isUp()`.
export function isUp(c: TriangleCoord): boolean {
  return c.isUp();
}

// One step from a triangle to the next one.
type Step = (from: TriangleCoord) => TriangleCoord;

// The move of one step depends on the orientation of the triangle.
interface OrientedStep {
  readonly up: Step;
  readonly down: Step;
}

const left: Step = (from) => from.left();
const right: Step = (from) => from.right();
const above: Step = (from) => from.above();
const below: Step = (from) => from.below();

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
  return c.isUp() ? step.up(c) : step.down(c);
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
    return coordKey(c.toString());
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

  // One rotation step is a sixth of a turn around the origin vertex.
  // Each step changes the orientation of the triangle, so no triangle stays in its place.
  // A caller places a turned piece with `translate()`, as on every other topology.
  rotate(c: TriangleCoord, turns: Turns): TriangleCoord {
    return turns.applyTo(c, (from) => from.turned(), this);
  }

  // The offset counts lattice cells, so every translation keeps the orientation of each triangle.
  translate(c: TriangleCoord, offset: TriangleCoord): TriangleCoord {
    return c.translated(offset);
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
  *ring(center: TriangleCoord, radius: Radius): Iterable<TriangleCoord> {
    const seen = new Set([this.key(center)]);
    // One step of the radius: the new cells that touch the frontier.
    const grow = (frontier: TriangleCoord[]): TriangleCoord[] => {
      const next: TriangleCoord[] = [];
      for (const c of frontier) {
        for (const n of this.neighbors(c)) {
          if (!seen.has(this.key(n))) {
            seen.add(this.key(n));
            next.push(n);
          }
        }
      }
      return next;
    };
    yield* radius.expand([center], grow);
  }

  // A rhombus of `size` × `size` lattice cells, two triangles each.
  region(size: RegionSize): BoardShape<TriangleCoord> {
    const cells: TriangleCoord[] = [];
    for (const j of size.indexes()) {
      for (const i of size.indexes()) {
        cells.push(triangle(2 * i + j, j), triangle(2 * i + j + 1, j));
      }
    }
    return BoardShape.of(cells);
  }
}
