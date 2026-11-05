import { BoardShape } from '../../../src/domain/engine/board-shape';
import { coordKey, type CoordKey } from '../../../src/domain/engine/coord-key';
import type { GridTopology } from '../../../src/domain/engine/grid-topology';

// The triangle topology double (issue 22, APP-NFR-13). It exists only in test/.
// A triangle at (col, row) points up when col + row is even, and down when it is odd.
// Classes.md decision 16: adding two coordinates one component at a time fails here.
export interface TriangleCoord {
  readonly col: number;
  readonly row: number;
}

// The closed unions of the triangle double: three axes and three directions.
export type TriangleAxis = 'row' | 'down-right' | 'down-left';
export type TriangleDirection = 'left' | 'right' | 'vertical';

export function triangle(col: number, row: number): TriangleCoord {
  return { col, row };
}

export function isUp(c: TriangleCoord): boolean {
  return (((c.col + c.row) % 2) + 2) % 2 === 0;
}

// Each row is a strip of triangles that alternate up and down.
// An up triangle touches the triangles left, right and below it.
// A down triangle touches the triangles left, right and above it.
function neighbors(c: TriangleCoord): TriangleCoord[] {
  const vertical = isUp(c) ? 1 : -1;
  return [
    triangle(c.col - 1, c.row),
    triangle(c.col + 1, c.row),
    triangle(c.col, c.row + vertical),
  ];
}

// One step along an axis, forward or backward. The `row` axis is a straight strip.
// The two diagonal axes zigzag: the step depends on the orientation of the triangle.
function step(c: TriangleCoord, axis: TriangleAxis, forward: boolean): TriangleCoord {
  const up = isUp(c);
  const { col, row } = c;
  switch (axis) {
    case 'row':
      return triangle(col + (forward ? 1 : -1), row);
    case 'down-right':
      if (forward) return up ? triangle(col, row + 1) : triangle(col + 1, row);
      return up ? triangle(col - 1, row) : triangle(col, row - 1);
    case 'down-left':
      if (forward) return up ? triangle(col, row + 1) : triangle(col - 1, row);
      return up ? triangle(col + 1, row) : triangle(col, row - 1);
    default:
      // This branch still runs when a caller casts a free string to an axis.
      throw new RangeError(`The triangle grid has no axis ${String(axis)}.`);
  }
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

function key(c: TriangleCoord): CoordKey {
  return coordKey(`${c.col},${c.row}`);
}

export const triangleTopology: GridTopology<TriangleCoord, TriangleAxis, TriangleDirection> = {
  rotationSteps: 6,
  key,
  neighbors,
  directions: () => ['left', 'right', 'vertical'],
  axes: () => ['row', 'down-right', 'down-left'],
  // A sixth of a turn around the origin vertex maps (x, y, z) to (1 - y, 1 - z, 1 - x).
  rotate: (c, turns) => {
    let [x, y, z] = toCube(c);
    for (let s = 0; s < ((turns.value % 6) + 6) % 6; s += 1) [x, y, z] = [1 - y, 1 - z, 1 - x];
    return fromCube([x, y, z]);
  },
  // The offset counts lattice cells: one step of `col` is two triangles to the right,
  // and one step of `row` is one row down and one triangle to the right.
  // So every translation keeps the orientation of each triangle.
  translate: (c, offset) => triangle(c.col + 2 * offset.col + offset.row, c.row + offset.row),
  *line(axis, through, contains) {
    let start = through;
    while (contains(step(start, axis, false))) start = step(start, axis, false);
    for (let c = start; contains(c); c = step(c, axis, true)) yield c;
  },
  // The cells at graph distance `radius`, found breadth first.
  *ring(center, { value: radius }) {
    let frontier = [center];
    const seen = new Set([key(center)]);
    for (let r = 0; r < radius; r += 1) {
      const next: TriangleCoord[] = [];
      for (const c of frontier) {
        for (const n of neighbors(c)) {
          if (!seen.has(key(n))) {
            seen.add(key(n));
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    yield* frontier;
  },
  // A rhombus of size × size lattice cells, two triangles each.
  region: ({ value: size }) => {
    const cells: TriangleCoord[] = [];
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        cells.push(triangle(2 * i + j, j), triangle(2 * i + j + 1, j));
      }
    }
    return BoardShape.of(cells);
  },
};
