import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridAxis, GridDirection, GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import { Turns } from './turns';

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

  // The count of steps between this cell and `other`.
  distanceTo(other: HexCoord): number {
    const dq = this.q - other.q;
    const dr = this.r - other.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  // This coordinate after a sixth of a turn around the origin: (q, r) becomes (-r, q + r).
  turned(): HexCoord {
    return HexCoord.of(-this.r, this.q + this.r);
  }

  // The text of the coordinate: `q,r`. `HexTopology` brands it as its key.
  toString(): string {
    return `${this.q},${this.r}`;
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

  // The name of the axis.
  toString(): string {
    return this.name;
  }
}

// A direction of the hex grid: the way from a cell to one of its six neighbors.
// It is a value object with a closed set of instances, as `HexAxis` is.
// A direction holds its step, and `neighborOf()` gives the neighbor of a cell.
export class HexDirection implements GridDirection {
  static readonly east = new HexDirection('east', hex(1, 0));
  static readonly west = new HexDirection('west', hex(-1, 0));
  static readonly southEast = new HexDirection('south-east', hex(0, 1));
  static readonly northWest = new HexDirection('north-west', hex(0, -1));
  static readonly southWest = new HexDirection('south-west', hex(-1, 1));
  static readonly northEast = new HexDirection('north-east', hex(1, -1));

  // The closed set, in the order of `HexTopology.directions()`.
  static readonly all: readonly HexDirection[] = Object.freeze([
    HexDirection.east,
    HexDirection.west,
    HexDirection.southEast,
    HexDirection.northWest,
    HexDirection.southWest,
    HexDirection.northEast,
  ]);

  private constructor(
    private readonly name: string,
    private readonly step: HexCoord,
  ) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (HexDirection.all !== undefined) {
      throw new RangeError('The set of hex directions is closed.');
    }
    Object.freeze(this);
  }

  // Two directions are equal when they are the same instance.
  equals(other: GridDirection): boolean {
    return this === other;
  }

  // The neighbor of `c` in this direction.
  neighborOf(c: HexCoord): HexCoord {
    return c.plus(this.step);
  }

  // The name of the direction.
  toString(): string {
    return this.name;
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
export class HexTopology implements GridTopology<HexCoord, HexAxis, HexDirection> {
  fullTurn(): Turns {
    return Turns.of(6);
  }

  key(c: HexCoord): CoordKey {
    return coordKey(c.toString());
  }

  neighbors(c: HexCoord): HexCoord[] {
    return around.map((direction) => direction.neighborOf(c));
  }

  neighbor(c: HexCoord, direction: HexDirection): HexCoord {
    // The check still runs when a caller casts another value to a direction.
    if (!(direction instanceof HexDirection)) {
      throw new RangeError(`The hex grid has no direction ${String(direction)}.`);
    }
    return direction.neighborOf(c);
  }

  // Each call gives a new list, so a change by one caller stays with that caller.
  directions(): HexDirection[] {
    return [...HexDirection.all];
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

  *line(axis: HexAxis, through: HexCoord, contains: (c: HexCoord) => boolean): Iterable<HexCoord> {
    // The check still runs when a caller casts another value to an axis.
    if (!(axis instanceof HexAxis))
      throw new RangeError(`The hex grid has no axis ${String(axis)}.`);
    let start = through;
    while (contains(axis.backward(start))) start = axis.backward(start);
    for (let c = start; contains(c); c = axis.forward(c)) yield c;
  }

  *ring(center: HexCoord, radius: Radius): Iterable<HexCoord> {
    for (const dq of radius.offsets()) {
      for (const dr of radius.offsets()) {
        const c = center.plus(hex(dq, dr));
        if (radius.measures(c.distanceTo(center))) yield c;
      }
    }
  }

  // A hexagon: the cells at distance `size - 1` or less from the origin.
  region(size: RegionSize): BoardShape<HexCoord> {
    const origin = hex(0, 0);
    const cells: HexCoord[] = [];
    for (const q of size.offsets()) {
      for (const r of size.offsets()) {
        const c = hex(q, r);
        if (size.holds(c.distanceTo(origin))) cells.push(c);
      }
    }
    return BoardShape.of(cells);
  }
}
