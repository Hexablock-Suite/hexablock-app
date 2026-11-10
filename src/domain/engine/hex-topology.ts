import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
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

// Three axes. Each axis gives two slide directions, so the board has six.
export type HexAxis = 'q' | 'r' | 's';
export type HexDirection =
  | 'east'
  | 'west'
  | 'south-east'
  | 'north-west'
  | 'south-west'
  | 'north-east';

// Creates a coordinate. It is the short name of `HexCoord.of()`, which checks the values.
export function hex(q: number, r: number): HexCoord {
  return HexCoord.of(q, r);
}

// One step forward along each axis. The axis `q` keeps `r`, the axis `r` keeps `q`,
// and the axis `s` keeps `s`. A `Map` has no inherited keys,
// so a cast name such as `constructor` finds no step.
const axisSteps: ReadonlyMap<string, HexCoord> = new Map([
  ['q', hex(1, 0)],
  ['r', hex(0, 1)],
  ['s', hex(1, -1)],
]);

// One step per direction, in the order of `neighbors()`.
const directionSteps: ReadonlyMap<string, HexCoord> = new Map([
  ['east', hex(1, 0)],
  ['north-east', hex(1, -1)],
  ['north-west', hex(0, -1)],
  ['west', hex(-1, 0)],
  ['south-west', hex(-1, 1)],
  ['south-east', hex(0, 1)],
]);

// Strategy (statement §3.3, D4): the real hexagonal topology. `HexGeometry` creates it.
export class HexTopology implements GridTopology<HexCoord, HexAxis, HexDirection> {
  fullTurn(): Turns {
    return Turns.of(6);
  }

  key(c: HexCoord): CoordKey {
    return coordKey(c.toString());
  }

  neighbors(c: HexCoord): HexCoord[] {
    return [...directionSteps.values()].map((step) => c.plus(step));
  }

  neighbor(c: HexCoord, direction: HexDirection): HexCoord {
    // The check still runs when a caller casts a free string to a direction.
    const step = directionSteps.get(direction);
    if (step === undefined) throw new RangeError(`The hex grid has no direction ${direction}.`);
    return c.plus(step);
  }

  directions(): HexDirection[] {
    return ['east', 'west', 'south-east', 'north-west', 'south-west', 'north-east'];
  }

  axes(): HexAxis[] {
    return ['q', 'r', 's'];
  }

  // One rotation step is a sixth of a turn.
  rotate(c: HexCoord, turns: Turns): HexCoord {
    return turns.applyTo(c, (from) => from.turned(), this);
  }

  translate(c: HexCoord, offset: HexCoord): HexCoord {
    return c.plus(offset);
  }

  *line(axis: HexAxis, through: HexCoord, contains: (c: HexCoord) => boolean): Iterable<HexCoord> {
    // The check still runs when a caller casts a free string to an axis.
    const step = axisSteps.get(axis);
    if (step === undefined) throw new RangeError(`The hex grid has no axis ${axis}.`);
    const back = step.opposite();
    let start = through;
    while (contains(start.plus(back))) start = start.plus(back);
    for (let c = start; contains(c); c = c.plus(step)) yield c;
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
