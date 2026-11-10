import { BoardShape } from './board-shape';
import { coordKey, type CoordKey } from './coord-key';
import type { GridAxis, GridDirection, GridTopology } from './grid-topology';
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

// Creates a coordinate. It is the short name of `SquareCoord.of()`, which checks the values.
export function square(col: number, row: number): SquareCoord {
  return SquareCoord.of(col, row);
}

// An axis of the square grid. Two axes exist.
// It is a value object with a closed set of instances (classes.md decision 45, issue #207).
// Each axis has one shared instance, which is frozen, so `equals()` compares by identity.
// An axis holds its step forward. It steps along itself from a cell
// with `forward()` and `backward()`.
export class SquareAxis implements GridAxis {
  static readonly col = new SquareAxis('col', square(1, 0));
  static readonly row = new SquareAxis('row', square(0, 1));

  // The closed set, in the order of `SquareTopology.axes()`.
  static readonly all: readonly SquareAxis[] = Object.freeze([SquareAxis.col, SquareAxis.row]);

  private constructor(
    private readonly name: string,
    private readonly step: SquareCoord,
  ) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (SquareAxis.all !== undefined) throw new RangeError('The set of square axes is closed.');
    Object.freeze(this);
  }

  // Two axes are equal when they are the same instance.
  equals(other: GridAxis): boolean {
    return this === other;
  }

  // The next cell along this axis.
  forward(from: SquareCoord): SquareCoord {
    return from.plus(this.step);
  }

  // The previous cell along this axis.
  backward(from: SquareCoord): SquareCoord {
    return from.plus(this.step.opposite());
  }

  // The name of the axis.
  toString(): string {
    return this.name;
  }
}

// A direction of the square grid: the way from a cell to one of its four neighbors.
// A square has no diagonal neighbor.
// It is a value object with a closed set of instances, as `SquareAxis` is.
// A direction holds its step, and `neighborOf()` gives the neighbor of a cell.
export class SquareDirection implements GridDirection {
  static readonly north = new SquareDirection('north', square(0, -1));
  static readonly east = new SquareDirection('east', square(1, 0));
  static readonly south = new SquareDirection('south', square(0, 1));
  static readonly west = new SquareDirection('west', square(-1, 0));

  // The closed set, in the order of `SquareTopology.directions()` and of `neighbors()`.
  static readonly all: readonly SquareDirection[] = Object.freeze([
    SquareDirection.north,
    SquareDirection.east,
    SquareDirection.south,
    SquareDirection.west,
  ]);

  private constructor(
    private readonly name: string,
    private readonly step: SquareCoord,
  ) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (SquareDirection.all !== undefined) {
      throw new RangeError('The set of square directions is closed.');
    }
    Object.freeze(this);
  }

  // Two directions are equal when they are the same instance.
  equals(other: GridDirection): boolean {
    return this === other;
  }

  // The neighbor of `c` in this direction.
  neighborOf(c: SquareCoord): SquareCoord {
    return c.plus(this.step);
  }

  // The name of the direction.
  toString(): string {
    return this.name;
  }
}

// Strategy (statement §3.3, D4): the real square topology. `SquareGeometry` creates it.
export class SquareTopology implements GridTopology<SquareCoord, SquareAxis, SquareDirection> {
  fullTurn(): Turns {
    return Turns.of(4);
  }

  key(c: SquareCoord): CoordKey {
    return coordKey(c.toString());
  }

  neighbors(c: SquareCoord): SquareCoord[] {
    return SquareDirection.all.map((direction) => direction.neighborOf(c));
  }

  neighbor(c: SquareCoord, direction: SquareDirection): SquareCoord {
    // The check still runs when a caller casts another value to a direction.
    if (!(direction instanceof SquareDirection)) {
      throw new RangeError(`The square grid has no direction ${String(direction)}.`);
    }
    return direction.neighborOf(c);
  }

  // Each call gives a new list, so a change by one caller stays with that caller.
  directions(): SquareDirection[] {
    return [...SquareDirection.all];
  }

  axes(): SquareAxis[] {
    return [...SquareAxis.all];
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
    // The check still runs when a caller casts another value to an axis.
    if (!(axis instanceof SquareAxis)) {
      throw new RangeError(`The square grid has no axis ${String(axis)}.`);
    }
    let start = through;
    while (contains(axis.backward(start))) start = axis.backward(start);
    for (let c = start; contains(c); c = axis.forward(c)) yield c;
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
