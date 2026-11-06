import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { coordKey } from '../../../../src/domain/engine/coord-key';
import type { GridTopology } from '../../../../src/domain/engine/grid-topology';

// A hexagonal topology double for the Merge rules tests. It exists only in test/.
// The real `HexTopology` comes with the geometry family, so the Merge tests bring their own.
// A coordinate is axial: `q` and `r`, and the third cube value is `s = -q - r`.
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

export function hex(q: number, r: number): HexCoord {
  // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
  return { q: 0 + q, r: 0 + r };
}

// One step forward along each axis. The axis `q` keeps `r`, the axis `r` keeps `q`,
// and the axis `s` keeps `s`.
const steps: Record<HexAxis, HexCoord> = { q: hex(1, 0), r: hex(0, 1), s: hex(1, -1) };

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

const neighborSteps = [hex(1, 0), hex(1, -1), hex(0, -1), hex(-1, 0), hex(-1, 1), hex(0, 1)];

export const hexTopology: GridTopology<HexCoord, HexAxis, HexDirection> = {
  rotationSteps: 6,
  key: (c) => coordKey(`${c.q},${c.r}`),
  neighbors: (c) => neighborSteps.map((s) => add(c, s)),
  directions: () => ['east', 'west', 'south-east', 'north-west', 'south-west', 'north-east'],
  axes: () => ['q', 'r', 's'],
  // A sixth of a turn maps (q, r) to (-r, q + r).
  rotate: (c, turns) => {
    let r = c;
    for (let i = 0; i < ((turns.value % 6) + 6) % 6; i += 1) r = hex(-r.r, r.q + r.r);
    return r;
  },
  translate: add,
  *line(axis, through, contains) {
    // The guard still runs when a caller casts a free string to an axis.
    const step: HexCoord | undefined = steps[axis];
    if (step === undefined) throw new RangeError(`The hex grid has no axis ${axis}.`);
    let start = through;
    while (contains(add(start, minus(step)))) start = add(start, minus(step));
    for (let c = start; contains(c); c = add(c, step)) yield c;
  },
  *ring(center, { value: radius }) {
    for (let dq = -radius; dq <= radius; dq += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        const c = add(center, hex(dq, dr));
        if (distance(c, center) === radius) yield c;
      }
    }
  },
  // A hexagon: the cells at distance `size - 1` or less from the origin.
  region: ({ value: size }) => {
    const cells: HexCoord[] = [];
    for (let q = 1 - size; q < size; q += 1) {
      for (let r = 1 - size; r < size; r += 1) {
        if (distance(hex(q, r), hex(0, 0)) < size) cells.push(hex(q, r));
      }
    }
    return BoardShape.of(cells);
  },
};
