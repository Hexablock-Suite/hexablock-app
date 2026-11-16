import { Score } from '../../engine/score';

// The points of each placed cell.
// The value codes the accepted rule of issue #59 (D22, 2026-11-06).
const POINTS_PER_CELL = 1;

// The count of cells that one Hexa Lines placement put on the board (issue #232).
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A count of cells is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private, and no operation returns it: the count gives its points as a `Score`.
export class CellCount {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): CellCount {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `A count of placed cells needs a whole number of 0 or more, not ${value}.`,
      );
    }
    return new CellCount(value === 0 ? 0 : value);
  }

  // Two counts are equal when they hold the same value.
  equals(other: CellCount): boolean {
    return this.value === other.value;
  }

  // The points of the placed cells: `POINTS_PER_CELL` for each cell.
  points(): Score {
    return Score.of(this.value * POINTS_PER_CELL);
  }
}
