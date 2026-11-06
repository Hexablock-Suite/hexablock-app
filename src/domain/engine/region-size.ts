// The size of a region that a topology builds: a whole number of one or more.
// It is a value object: it never changes.
// A number above `Number.MAX_SAFE_INTEGER` is an error.
export class RegionSize {
  private constructor(readonly value: number) {}

  static of(value: number): RegionSize {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`A region size needs a whole number of one or more, not ${value}.`);
    }
    return new RegionSize(value);
  }
}
