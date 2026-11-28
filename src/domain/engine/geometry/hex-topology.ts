import { BoardShape } from './board-shape';
import { CoordKey } from './coord-key';
import { Distance } from './distance';
import type { GridAxis, GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import { Turns } from './turns';
import type { ValueReceiver } from '../../shared/value-receiver';

// A coordinate is axial: `q` and `r`, and the third cube value is `s = -q - r`.
// It is a value object (classes.md decisions 16 and 44, issue #206): it never changes,
// and two coordinates are equal when their values are equal.
// The values are private. The coordinate does every calculation on its own values.
// `HexTopology` does what belongs to the grid: the neighbors, the lines, the rings and the regions.
export class HexCoord {
  private constructor(
    private readonly q: number,
    private readonly r: number,
  ) {
    // The object is frozen, because `private` and `readonly` hold only at compile time.
    Object.freeze(this);
  }

  // Creates a coordinate. A value that is not a safe integer is an error.
  static of(q: number, r: number): HexCoord {
    if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) {
      throw new RangeError(`A hex coordinate needs whole numbers, not ${q}, ${r}.`);
    }
    // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
    return new HexCoord(0 + q, 0 + r);
  }

  // Two coordinates are equal when they hold the same values.
  equals(other: HexCoord): boolean {
    return this.q === other.q && this.r === other.r;
  }

  // The sum of two coordinates, one value at a time. Neither coordinate changes.
  plus(other: HexCoord): HexCoord {
    return HexCoord.of(this.q + other.q, this.r + other.r);
  }

  // The coordinate on the other side of the origin.
  opposite(): HexCoord {
    return HexCoord.of(-this.q, -this.r);
  }

  // The count of steps between this cell and `other`, as a `Distance` (issue #243).
  distanceTo(other: HexCoord): Distance {
    const dq = this.q - other.q;
    const dr = this.r - other.r;
    return Distance.of((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
  }

  // This coordinate after a sixth of a turn around the origin: (q, r) becomes (-r, q + r).
  turned(): HexCoord {
    return HexCoord.of(-this.r, this.q + this.r);
  }

  // The key of the coordinate: `q,r`, as a `CoordKey` value object (issues #237 and #246).
  // `HexTopology.key()` gives it to the engine, so the topology reads no text.
  key(): CoordKey {
    return CoordKey.of(`${this.q},${this.r}`);
  }

  // Gives the two values of the coordinate, `[q, r]`, to `receiver`. It returns nothing.
  // A screen layout of layer 4 places the cell from them (issue #165).
  // No code of the domain or of the use cases calls it (rule R-no-delivery-call).
  deliverTo(receiver: ValueReceiver<readonly [number, number]>): void {
    receiver.receive([this.q, this.r]);
  }
}

// Creates a coordinate. It is the short name of `HexCoord.of()`, which checks the values.
export function hex(q: number, r: number): HexCoord {
  return HexCoord.of(q, r);
}

// An axis of the hex grid. Three axes exist. Each axis gives two slide directions,
// so the board has six.
// It is a value object with a closed set of instances (classes.md decision 45, issue #207).
// Each axis has one shared instance, which is frozen, so `equals()` compares by identity.
// An axis holds its step forward: the axis `q` keeps `r`, the axis `r` keeps `q`,
// and the axis `s` keeps `s`. It steps along itself from a cell with `forward()` and `backward()`.
export class HexAxis implements GridAxis {
  static readonly q = new HexAxis('q', hex(1, 0));
  static readonly r = new HexAxis('r', hex(0, 1));
  static readonly s = new HexAxis('s', hex(1, -1));

  // The closed set, in the order of `HexTopology.axes()`.
  static readonly all: readonly HexAxis[] = Object.freeze([HexAxis.q, HexAxis.r, HexAxis.s]);

  private constructor(
    private readonly name: string,
    private readonly step: HexCoord,
  ) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (HexAxis.all !== undefined) throw new RangeError('The set of hex axes is closed.');
    Object.freeze(this);
  }

  // Two axes are equal when they are the same instance.
  equals(other: GridAxis): boolean {
    return this === other;
  }

  // The next cell along this axis.
  forward(from: HexCoord): HexCoord {
    return from.plus(this.step);
  }

  // The previous cell along this axis.
  backward(from: HexCoord): HexCoord {
    return from.plus(this.step.opposite());
  }

  // Gives the name of the axis to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<string>): void {
    receiver.receive(this.name);
  }
}

// A direction of the hex grid: the way from a cell to one of its six neighbors.
// It is private to this file: only `neighbors()` reads it (classes.md decision 16, issue #416).
// A slide follows an axis and a sense, not a direction.
// A direction holds its step, and `neighborOf()` gives the neighbor of a cell.
class HexDirection {
  static readonly east = new HexDirection(hex(1, 0));
  static readonly west = new HexDirection(hex(-1, 0));
  static readonly southEast = new HexDirection(hex(0, 1));
  static readonly northWest = new HexDirection(hex(0, -1));
  static readonly southWest = new HexDirection(hex(-1, 1));
  static readonly northEast = new HexDirection(hex(1, -1));

  private constructor(private readonly step: HexCoord) {
    Object.freeze(this);
  }

  // The neighbor of `c` in this direction.
  neighborOf(c: HexCoord): HexCoord {
    return c.plus(this.step);
  }
}

// The directions in the order of `neighbors()`: around the cell, from the east.
const around: readonly HexDirection[] = [
  HexDirection.east,
  HexDirection.northEast,
  HexDirection.northWest,
  HexDirection.west,
  HexDirection.southWest,
  HexDirection.southEast,
];

// Strategy (statement §3.3, D4): the real hexagonal topology. `HexGeometry` creates it.
export class HexTopology implements GridTopology<HexCoord, HexAxis> {
  fullTurn(): Turns {
    return Turns.of(6);
  }

  // The coordinate builds its own key.
  key(c: HexCoord): CoordKey {
    return c.key();
  }

  neighbors(c: HexCoord): HexCoord[] {
    return around.map((direction) => direction.neighborOf(c));
  }

  axes(): HexAxis[] {
    return [...HexAxis.all];
  }

  // One rotation step is a sixth of a turn.
  rotate(c: HexCoord, turns: Turns): HexCoord {
    return turns.applyTo(c, (from) => from.turned(), this);
  }

  translate(c: HexCoord, offset: HexCoord): HexCoord {
    return c.plus(offset);
  }

  translationOffset(from: HexCoord, to: HexCoord): HexCoord {
    return to.plus(from.opposite());
  }

  *line(axis: HexAxis, through: HexCoord, contains: (c: HexCoord) => boolean): Iterable<HexCoord> {
    // The check still runs when a caller casts another value to an axis.
    // The error carries that value as its `cause`, and the edge delivers its text (issue #237).
    if (!(axis instanceof HexAxis)) {
      throw new RangeError('The hex grid has no such axis.', { cause: axis });
    }
    let start = through;
    while (contains(axis.backward(start))) start = axis.backward(start);
    for (let c = start; contains(c); c = axis.forward(c)) yield c;
  }

  // The cells of the square of offsets around the center, along `q` and then along `r`,
  // that lie exactly at the distance of the radius.
  *ring(center: HexCoord, radius: Radius): Iterable<HexCoord> {
    for (const column of radius.offsets(center, HexAxis.q)) {
      for (const c of radius.offsets(column, HexAxis.r)) {
        if (radius.measures(c.distanceTo(center))) yield c;
      }
    }
  }

  // A hexagon: the cells at distance `size - 1` or less from the origin.
  region(size: RegionSize): BoardShape<HexCoord> {
    const origin = hex(0, 0);
    const cells: HexCoord[] = [];
    for (const column of size.offsets(origin, HexAxis.q)) {
      for (const c of size.offsets(column, HexAxis.r)) {
        if (size.holds(c.distanceTo(origin))) cells.push(c);
      }
    }
    return BoardShape.of(cells);
  }
}
