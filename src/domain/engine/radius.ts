// The distance of a ring from its center: a whole number of zero or more.
// Radius 0 gives the center. It is a value object: it never changes.
// A number above `Number.MAX_SAFE_INTEGER` is an error. A negative zero is stored as 0.
export class Radius {
  private constructor(readonly value: number) {}

  static of(value: number): Radius {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A radius needs a whole number of zero or more, not ${value}.`);
    }
    return new Radius(value === 0 ? 0 : value);
  }
}
