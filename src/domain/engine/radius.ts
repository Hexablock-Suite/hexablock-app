// The distance of a ring from its center: a whole number of zero or more.
// Radius 0 gives the center. It is a value object: it never changes.
export class Radius {
  private constructor(readonly value: number) {}

  static of(value: number): Radius {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`A radius needs a whole number of zero or more, not ${value}.`);
    }
    return new Radius(value);
  }
}
