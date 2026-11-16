import type { Ordered } from './ordered';

// The distance between two cells of a board: a count of steps, a whole number of zero or more
// (classes.md decision 44, issue #243). It is a value object: it never changes.
// `of()` is the only place that checks the count. A count above `Number.MAX_SAFE_INTEGER`
// is an error. A negative zero is stored as 0.
// The count stays private. A coordinate measures it, and `Radius` and `RegionSize` compare it
// with `equals()` and `isBefore()`.
export class Distance implements Ordered<Distance> {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Distance {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A distance needs a whole number of zero or more, not ${value}.`);
    }
    return new Distance(value === 0 ? 0 : value);
  }

  // Two distances are equal when they hold the same count.
  equals(other: Distance): boolean {
    return this.value === other.value;
  }

  // Tells if this distance is shorter than the other distance.
  isBefore(other: Distance): boolean {
    return this.value < other.value;
  }
}
