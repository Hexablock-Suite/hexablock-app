import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { Radius } from './radius';
import type { RegionSize } from './region-size';
import { Turns } from './turns';

// A coordinate holds a column and a row.
// It is a value object (classes.md decisions 16 and 44, issue #206): it never changes,
// and two coordinates are equal when their values are equal.
// The values are private. The coordinate does every calculation on its own values.
// `SquareTopology` does what belongs to the grid: the neighbors, the lines, the rings and the regions.
export class SquareCoord {
  private constructor(
    private readonly col: number,
    private readonly row: number,
  ) {
    // The object is frozen, because `private` and `readonly` hold only at compile time.
    Object.freeze(this);
  }

  // Creates a coordinate. A value that is not a safe integer is an error.
  static of(col: number, row: number): SquareCoord {
    if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row)) {
      throw new RangeError(`A square coordinate needs whole numbers, not ${col}, ${row}.`);
    }
    // `0 + x` stores a negative zero as 0, so two equal coordinates have one key.
    return new SquareCoord(0 + col, 0 + row);
  }

  // Two coordinates are equal when they hold the same values.
  equals(other: SquareCoord): boolean {
    return this.col === other.col && this.row === other.row;
  }

  // The sum of two coordinates, one value at a time. Neither coordinate changes.
  plus(other: SquareCoord): SquareCoord {
    return SquareCoord.of(this.col + other.col, this.row + other.row);
  }

  // The coordinate on the other side of the origin.
  opposite(): SquareCoord {
    return SquareCoord.of(-this.col, -this.row);
  }

  // This coordinate after a quarter turn around the origin: (col, row) becomes (-row, col).
  turned(): SquareCoord {
    return SquareCoord.of(-this.row, this.col);
  }

  // The text of the coordinate: `col,row`. `SquareTopology` brands it as its key.
  toString(): string {
    return `${this.col},${this.row}`;
  }
}

// Two axes and four directions. A square has no diagonal neighbor.
export type SquareAxis = 'col' | 'row';
export type SquareDirection = 'north' | 'east' | 'south' | 'west';

// Creates a coordinate. It is the short name of `SquareCoord.of()`, which checks the values.
export function square(col: number, row: number): SquareCoord {
  return SquareCoord.of(col, row);
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

// Strategy (statement §3.3, D4): the real square topology. `SquareGeometry` creates it.
export class SquareTopology implements GridTopology<SquareCoord, SquareAxis, SquareDirection> {
  fullTurn(): Turns {
    return Turns.of(4);
  }

  key(c: SquareCoord): CoordKey {
    return coordKey(c.toString());
  }

  neighbors(c: SquareCoord): SquareCoord[] {
    return [...directionSteps.values()].map((step) => c.plus(step));
  }

  neighbor(c: SquareCoord, direction: SquareDirection): SquareCoord {
    // The check still runs when a caller casts a free string to a direction.
    const step = directionSteps.get(direction);
    if (step === undefined) throw new RangeError(`The square grid has no direction ${direction}.`);
    return c.plus(step);
  }

  directions(): SquareDirection[] {
    return ['north', 'east', 'south', 'west'];
  }

  axes(): SquareAxis[] {
    return ['col', 'row'];
  }

  // One rotation step is a quarter turn.
  rotate(c: SquareCoord, turns: Turns): SquareCoord {
    return turns.applyTo(c, (from) => from.turned(), this);
  }

  translate(c: SquareCoord, offset: SquareCoord): SquareCoord {
    return c.plus(offset);
  }

  *line(
    axis: SquareAxis,
    through: SquareCoord,
    contains: (c: SquareCoord) => boolean,
  ): Iterable<SquareCoord> {
    // The check still runs when a caller casts a free string to an axis.
    const step = axisSteps.get(axis);
    if (step === undefined) throw new RangeError(`The square grid has no axis ${axis}.`);
    const back = step.opposite();
    let start = through;
    while (contains(start.plus(back))) start = start.plus(back);
    for (let c = start; contains(c); c = c.plus(step)) yield c;
  }

  // The cells at Manhattan distance `radius`, the distance of the four neighbors.
  // Each column offset has one row offset of zero or more that completes the distance.
  // The cell below the center comes first, and then the cell above it.
  *ring(center: SquareCoord, radius: Radius): Iterable<SquareCoord> {
    for (const dc of radius.offsets()) {
      for (const dr of radius.offsets()) {
        if (dr < 0 || !radius.measures(Math.abs(dc) + dr)) continue;
        yield center.plus(square(dc, dr));
        if (dr !== 0) yield center.plus(square(dc, -dr));
      }
    }
  }

  // A square of `size` × `size` cells. Its corner is the origin.
  region(size: RegionSize): BoardShape<SquareCoord> {
    const cells: SquareCoord[] = [];
    for (const row of size.indexes()) {
      for (const col of size.indexes()) cells.push(square(col, row));
    }
    return BoardShape.of(cells);
  }
}
