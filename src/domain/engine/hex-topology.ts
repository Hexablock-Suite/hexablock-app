import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import type { Turns } from './turns';

// A coordinate is axial: `q` and `r`, and the third cube value is `s = -q - r`.
// It only holds its values. `HexTopology` does every calculation (classes.md decision 16).
export interface HexCoord {
  readonly q: number;
  readonly r: number;
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

// Creates a coordinate. A value that is not a safe integer is an error.
// The object is frozen, because `readonly` holds only at compile time.
export function hex(q: number, r: number): HexCoord {
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) {
    throw new RangeError(`A hex coordinate needs whole numbers, not ${q}, ${r}.`);
  }
  // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
  return Object.freeze({ q: 0 + q, r: 0 + r });
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

function add(a: HexCoord, b: HexCoord): HexCoord {
  return hex(a.q + b.q, a.r + b.r);
}

function minus(c: HexCoord): HexCoord {
  return hex(-c.q, -c.r);
}

function distance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// Strategy (statement §3.3, D4): the real hexagonal topology. `HexGeometry` creates it.
export class HexTopology implements GridTopology<HexCoord, HexAxis, HexDirection> {
  readonly rotationSteps = 6;

  key(c: HexCoord): CoordKey {
    return coordKey(`${c.q},${c.r}`);
  }

  neighbors(c: HexCoord): HexCoord[] {
    return [...directionSteps.values()].map((step) => add(c, step));
  }

  neighbor(c: HexCoord, direction: HexDirection): HexCoord {
    // The check still runs when a caller casts a free string to a direction.
    const step = directionSteps.get(direction);
    if (step === undefined) throw new RangeError(`The hex grid has no direction ${direction}.`);
    return add(c, step);
  }

  directions(): HexDirection[] {
    return ['east', 'west', 'south-east', 'north-west', 'south-west', 'north-east'];
  }

  axes(): HexAxis[] {
    return ['q', 'r', 's'];
  }

  // A sixth of a turn maps (q, r) to (-r, q + r).
  rotate(c: HexCoord, turns: Turns): HexCoord {
    const steps = ((turns.value % this.rotationSteps) + this.rotationSteps) % this.rotationSteps;
    let turned = c;
    for (let i = 0; i < steps; i += 1) turned = hex(-turned.r, turned.q + turned.r);
    return turned;
  }

  translate(c: HexCoord, offset: HexCoord): HexCoord {
    return add(c, offset);
  }

  *line(axis: HexAxis, through: HexCoord, contains: (c: HexCoord) => boolean): Iterable<HexCoord> {
    // The check still runs when a caller casts a free string to an axis.
    const step = axisSteps.get(axis);
    if (step === undefined) throw new RangeError(`The hex grid has no axis ${axis}.`);
    const back = minus(step);
    let start = through;
    while (contains(add(start, back))) start = add(start, back);
    for (let c = start; contains(c); c = add(c, step)) yield c;
  }

  *ring(center: HexCoord, { value: radius }: Radius): Iterable<HexCoord> {
    for (let dq = -radius; dq <= radius; dq += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        const c = add(center, hex(dq, dr));
        if (distance(c, center) === radius) yield c;
      }
    }
  }

  // A hexagon: the cells at distance `size - 1` or less from the origin.
  region({ value: size }: RegionSize): BoardShape<HexCoord> {
    const cells: HexCoord[] = [];
    for (let q = 1 - size; q < size; q += 1) {
      for (let r = 1 - size; r < size; r += 1) {
        if (distance(hex(q, r), hex(0, 0)) < size) cells.push(hex(q, r));
      }
    }
    return BoardShape.of(cells);
  }
}
