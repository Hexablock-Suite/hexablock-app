import { Score } from '../../shared/score';

// The points of each tile in a cleared stack. The accepted rule of issue #59 (D22,
// 2026-11-06): a cleared stack of 10 tiles gives 100 points.
const SORT_POINTS_PER_TILE = 10;

// The count of tiles of one Hexa Sort stack: the height of the stack (statement §1.3, issue #232).
// `ColorStack.tileCount()` gives it, and the photo keeps the count of each stack
// that the last turn cleared.
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A count of tiles is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private, and no operation returns it: the count gives its points as a `Score`.
export class TileCount {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): TileCount {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A count of tiles needs a whole number of 0 or more, not ${value}.`);
    }
    return new TileCount(value === 0 ? 0 : value);
  }

  // Two counts are equal when they hold the same value.
  equals(other: TileCount): boolean {
    return this.value === other.value;
  }

  // The points of a cleared stack of this many tiles: `SORT_POINTS_PER_TILE` for each tile.
  points(): Score {
    return Score.of(this.value * SORT_POINTS_PER_TILE);
  }
}
