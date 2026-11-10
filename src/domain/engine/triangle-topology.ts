import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridAxis, GridDirection, GridTopology } from './grid-topology';
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

function follow(c: TriangleCoord, step: OrientedStep): TriangleCoord {
  return c.isUp() ? step.up(c) : step.down(c);
}

// An axis of the triangle grid. Three axes exist. The `row` axis is a straight strip,
// and the two diagonal axes zigzag.
// It is a value object with a closed set of instances (classes.md decision 45, issue #207).
// Each axis has one shared instance, which is frozen, so `equals()` compares by identity.
// An axis holds its step forward and its step backward. Each step depends on the orientation
// of the triangle. It steps along itself from a cell with `forward()` and `backward()`.
export class TriangleAxis implements GridAxis {
  static readonly row = new TriangleAxis(
    'row',
    { up: right, down: right },
    { up: left, down: left },
  );
  static readonly downRight = new TriangleAxis(
    'down-right',
    { up: below, down: right },
    { up: left, down: above },
  );
  static readonly downLeft = new TriangleAxis(
    'down-left',
    { up: below, down: left },
    { up: right, down: above },
  );

  // The closed set, in the order of `TriangleTopology.axes()`.
  static readonly all: readonly TriangleAxis[] = Object.freeze([
    TriangleAxis.row,
    TriangleAxis.downRight,
    TriangleAxis.downLeft,
  ]);

  private constructor(
    private readonly name: string,
    private readonly ahead: OrientedStep,
    private readonly behind: OrientedStep,
  ) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (TriangleAxis.all !== undefined) {
      throw new RangeError('The set of triangle axes is closed.');
    }
    Object.freeze(this);
  }

  // Two axes are equal when they are the same instance.
  equals(other: GridAxis): boolean {
    return this === other;
  }

  // The next cell along this axis.
  forward(from: TriangleCoord): TriangleCoord {
    return follow(from, this.ahead);
  }

  // The previous cell along this axis.
  backward(from: TriangleCoord): TriangleCoord {
    return follow(from, this.behind);
  }

  // The name of the axis.
  toString(): string {
    return this.name;
  }
}

// A direction of the triangle grid: the way from a cell to one of its three neighbors.
// Each row is a strip of triangles that alternate up and down.
// An up triangle touches the triangles left, right and below it.
// A down triangle touches the triangles left, right and above it.
// So the `vertical` direction goes down from an up triangle and up from a down triangle.
// It is a value object with a closed set of instances, as `TriangleAxis` is.
// A direction holds its step, and `neighborOf()` gives the neighbor of a cell.
export class TriangleDirection implements GridDirection {
  static readonly left = new TriangleDirection('left', { up: left, down: left });
  static readonly right = new TriangleDirection('right', { up: right, down: right });
  static readonly vertical = new TriangleDirection('vertical', { up: below, down: above });

  // The closed set, in the order of `TriangleTopology.directions()` and of `neighbors()`.
  static readonly all: readonly TriangleDirection[] = Object.freeze([
    TriangleDirection.left,
    TriangleDirection.right,
    TriangleDirection.vertical,
  ]);

  private constructor(
    private readonly name: string,
    private readonly step: OrientedStep,
  ) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (TriangleDirection.all !== undefined) {
      throw new RangeError('The set of triangle directions is closed.');
    }
    Object.freeze(this);
  }

  // Two directions are equal when they are the same instance.
  equals(other: GridDirection): boolean {
    return this === other;
  }

  // The neighbor of `c` in this direction.
  neighborOf(c: TriangleCoord): TriangleCoord {
    return follow(c, this.step);
  }

  // The name of the direction.
  toString(): string {
    return this.name;
  }
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
    return TriangleDirection.all.map((direction) => direction.neighborOf(c));
  }

  neighbor(c: TriangleCoord, direction: TriangleDirection): TriangleCoord {
    // The check still runs when a caller casts another value to a direction.
    if (!(direction instanceof TriangleDirection)) {
      throw new RangeError(`The triangle grid has no direction ${String(direction)}.`);
    }
    return direction.neighborOf(c);
  }

  // Each call gives a new list, so a change by one caller stays with that caller.
  directions(): TriangleDirection[] {
    return [...TriangleDirection.all];
  }

  axes(): TriangleAxis[] {
    return [...TriangleAxis.all];
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
    // The check still runs when a caller casts another value to an axis.
    if (!(axis instanceof TriangleAxis)) {
      throw new RangeError(`The triangle grid has no axis ${String(axis)}.`);
    }
    let start = through;
    while (contains(axis.backward(start))) start = axis.backward(start);
    for (let c = start; contains(c); c = axis.forward(c)) yield c;
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
