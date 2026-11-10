import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import type { Turns } from './turns';

// A coordinate holds a column and a row.
// It only holds its values. `SquareTopology` does every calculation (classes.md decision 16).
export interface SquareCoord {
  readonly col: number;
  readonly row: number;
}

// Two axes and four directions. A square has no diagonal neighbor.
export type SquareAxis = 'col' | 'row';
export type SquareDirection = 'north' | 'east' | 'south' | 'west';

// Creates a coordinate. A value that is not a safe integer is an error.
// The object is frozen, because `readonly` holds only at compile time.
export function square(col: number, row: number): SquareCoord {
  if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row)) {
    throw new RangeError(`A square coordinate needs whole numbers, not ${col}, ${row}.`);
  }
  // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
  return Object.freeze({ col: 0 + col, row: 0 + row });
}

// One step forward along each axis. A `Map` has no inherited keys,
// so a cast name such as `constructor` finds no step.
const axisSteps: ReadonlyMap<string, SquareCoord> = new Map([
  ['col', square(1, 0)],
  ['row', square(0, 1)],
]);

// One step per direction, in the order of `neighbors()`.
const directionSteps: ReadonlyMap<string, SquareCoord> = new Map([
  ['north', square(0, -1)],
  ['east', square(1, 0)],
  ['south', square(0, 1)],
  ['west', square(-1, 0)],
]);

function add(a: SquareCoord, b: SquareCoord): SquareCoord {
  return square(a.col + b.col, a.row + b.row);
}

function minus(c: SquareCoord): SquareCoord {
  return square(-c.col, -c.row);
}

// Strategy (statement §3.3, D4): the real square topology. `SquareGeometry` creates it.
export class SquareTopology implements GridTopology<SquareCoord, SquareAxis, SquareDirection> {
  readonly rotationSteps = 4;

  key(c: SquareCoord): CoordKey {
    return coordKey(`${c.col},${c.row}`);
  }

  neighbors(c: SquareCoord): SquareCoord[] {
    return [...directionSteps.values()].map((step) => add(c, step));
  }

  neighbor(c: SquareCoord, direction: SquareDirection): SquareCoord {
    // The check still runs when a caller casts a free string to a direction.
    const step = directionSteps.get(direction);
    if (step === undefined) throw new RangeError(`The square grid has no direction ${direction}.`);
    return add(c, step);
  }

  directions(): SquareDirection[] {
    return ['north', 'east', 'south', 'west'];
  }

  axes(): SquareAxis[] {
    return ['col', 'row'];
  }

  // A quarter turn maps (col, row) to (-row, col).
  rotate(c: SquareCoord, turns: Turns): SquareCoord {
    const steps = turns.normalized(this).value;
    let turned = c;
    for (let i = 0; i < steps; i += 1) turned = square(-turned.row, turned.col);
    return turned;
  }

  translate(c: SquareCoord, offset: SquareCoord): SquareCoord {
    return add(c, offset);
  }

  *line(
    axis: SquareAxis,
    through: SquareCoord,
    contains: (c: SquareCoord) => boolean,
  ): Iterable<SquareCoord> {
    // The check still runs when a caller casts a free string to an axis.
    const step = axisSteps.get(axis);
    if (step === undefined) throw new RangeError(`The square grid has no axis ${axis}.`);
    const back = minus(step);
    let start = through;
    while (contains(add(start, back))) start = add(start, back);
    for (let c = start; contains(c); c = add(c, step)) yield c;
  }

  // The cells at Manhattan distance `radius`, the distance of the four neighbors.
  *ring(center: SquareCoord, { value: radius }: Radius): Iterable<SquareCoord> {
    if (radius === 0) {
      yield center;
      return;
    }
    for (let dc = -radius; dc <= radius; dc += 1) {
      const dr = radius - Math.abs(dc);
      yield add(center, square(dc, dr));
      if (dr !== 0) yield add(center, square(dc, -dr));
    }
  }

  // A square of `size` × `size` cells. Its corner is the origin.
  region({ value: size }: RegionSize): BoardShape<SquareCoord> {
    const cells: SquareCoord[] = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) cells.push(square(col, row));
    }
    return BoardShape.of(cells);
  }
}
