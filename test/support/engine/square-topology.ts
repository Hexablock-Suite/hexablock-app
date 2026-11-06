import { BoardShape } from '../../../src/domain/engine/board-shape';
import { coordKey } from '../../../src/domain/engine/coord-key';
import type { GridTopology } from '../../../src/domain/engine/grid-topology';

// The square topology double of D4 (APP-NFR-13). It exists only in test/.
// It cannot catch parity coupling: a square adds coordinates the same way a hexagon does.
// The triangle double covers that gap (classes.md decision 16).
export interface SquareCoord {
  readonly col: number;
  readonly row: number;
}

// The closed unions of the square double: two axes and four directions.
export type SquareAxis = 'col' | 'row';
export type SquareDirection = 'north' | 'east' | 'south' | 'west';

export function square(col: number, row: number): SquareCoord {
  return { col, row };
}

const steps: Record<SquareAxis, SquareCoord> = { col: square(1, 0), row: square(0, 1) };

function add(a: SquareCoord, b: SquareCoord): SquareCoord {
  return square(a.col + b.col, a.row + b.row);
}

function minus(c: SquareCoord): SquareCoord {
  return square(0 - c.col, 0 - c.row);
}

export const squareTopology: GridTopology<SquareCoord, SquareAxis, SquareDirection> = {
  rotationSteps: 4,
  key: (c) => coordKey(`${c.col},${c.row}`),
  neighbors: (c) => [
    add(c, square(0, -1)),
    add(c, square(1, 0)),
    add(c, square(0, 1)),
    add(c, square(-1, 0)),
  ],
  directions: () => ['north', 'east', 'south', 'west'],
  axes: () => ['col', 'row'],
  // A quarter turn maps (col, row) to (-row, col). `0 - x` avoids a negative zero.
  rotate: (c, turns) => {
    let r = c;
    for (let i = 0; i < ((turns.value % 4) + 4) % 4; i += 1) r = square(0 - r.row, r.col);
    return r;
  },
  translate: add,
  *line(axis, through, contains) {
    // The guard still runs when a caller casts a free string to an axis.
    const step: SquareCoord | undefined = steps[axis];
    if (step === undefined) throw new RangeError(`The square grid has no axis ${axis}.`);
    let start = through;
    while (contains(add(start, minus(step)))) start = add(start, minus(step));
    for (let c = start; contains(c); c = add(c, step)) yield c;
  },
  // The cells at Manhattan distance `radius`, the distance of the four neighbors.
  *ring(center, { value: radius }) {
    if (radius === 0) {
      yield center;
      return;
    }
    for (let dc = -radius; dc <= radius; dc += 1) {
      const dr = radius - Math.abs(dc);
      yield add(center, square(dc, dr));
      if (dr !== 0) yield add(center, square(dc, -dr));
    }
  },
  region: ({ value: size }) => {
    const cells: SquareCoord[] = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) cells.push(square(col, row));
    }
    return BoardShape.of(cells);
  },
};
