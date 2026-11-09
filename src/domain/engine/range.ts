// Orders two values as `Array.prototype.sort` does: a negative number, zero or a positive number.
// NaN means that the two values have no order.
export type Compare<T> = (left: T, right: T) => number;

// A closed interval [min, max] over any ordered type (issue #129). It is a value object:
// it never changes. `contains()` tells if a value lies inside the bounds.
// It mirrors the `Range<T>` of hexablock-api: the same API and the same message.
// The limits of the domain that have two sides use it, such as a seed or the goal of a level.
export class Range<T> {
  private constructor(
    readonly min: T,
    readonly max: T,
    private readonly compare: Compare<T>,
  ) {}

  // Throws a RangeError when min comes after max or when the bounds have no order.
  static of<T>(min: T, max: T, compare: Compare<T>): Range<T> {
    if (!(compare(min, max) <= 0)) {
      throw new RangeError('A Range needs min <= max.');
    }
    return new Range(min, max, compare);
  }

  static ofNumbers(min: number, max: number): Range<number> {
    return Range.of(min, max, compareNumbers);
  }

  // A value without an order, such as NaN, is never inside the range.
  contains(value: T): boolean {
    return this.compare(this.min, value) <= 0 && this.compare(value, this.max) <= 0;
  }

  // Two ranges are equal when each one reads the bounds of both as the same bounds.
  // The order of the range compares the bounds, so `T` needs no `equals`.
  // Each range asks its own order, so the answer is the same in both directions.
  equals(other: Range<T>): boolean {
    return this.hasBoundsOf(other) && other.hasBoundsOf(this);
  }

  private hasBoundsOf(other: Range<T>): boolean {
    return this.compare(this.min, other.min) === 0 && this.compare(this.max, other.max) === 0;
  }
}

// Subtraction gives NaN for two equal infinities, so this function compares.
// It reads -0 and 0 as equal.
function compareNumbers(left: number, right: number): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return left === right ? 0 : Number.NaN;
}
