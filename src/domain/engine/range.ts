import type { Ordered } from './ordered';

// A closed interval [min, max] over a value object that knows its order (issues #129 and #239).
// It is a value object: it never changes. `contains()` tells if a value lies inside the bounds.
// The bound `Ordered<T>` gives the order: `T` answers `isBefore()`, so no order is a number.
// A business limit between two value objects uses it. A value object that wraps one number
// checks that number in its own factory method, as `Seed` and `GoalCount` do.
// It keeps the message of the `Range<T>` of hexablock-api.
export class Range<T extends Ordered<T>> {
  private constructor(
    private readonly min: T,
    private readonly max: T,
  ) {}

  // Throws a RangeError when min comes after max.
  static of<T extends Ordered<T>>(min: T, max: T): Range<T> {
    if (max.isBefore(min)) {
      throw new RangeError('A Range needs min <= max.');
    }
    return new Range(min, max);
  }

  // A value lies inside when it comes neither before min nor after max.
  contains(value: T): boolean {
    return !value.isBefore(this.min) && !this.max.isBefore(value);
  }

  // Two ranges are equal when their bounds share their places in the order of `T`.
  // So `T` needs no `equals`, and the answer is the same in both directions.
  equals(other: Range<T>): boolean {
    return this.samePlace(this.min, other.min) && this.samePlace(this.max, other.max);
  }

  // Two values share a place when neither one comes before the other.
  private samePlace(left: T, right: T): boolean {
    return !left.isBefore(right) && !right.isBefore(left);
  }
}
