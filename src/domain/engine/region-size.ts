// The size of a region that a topology builds: a whole number of one or more.
// It is a value object: it never changes.
// A number above `Number.MAX_SAFE_INTEGER` is an error.
// The number stays private (classes.md decision 44, issue #206).
// A topology builds a region through the operations of the size.
export class RegionSize {
  private constructor(private readonly value: number) {}

  static of(value: number): RegionSize {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`A region size needs a whole number of one or more, not ${value}.`);
    }
    return new RegionSize(value);
  }

  // Two region sizes are equal when they hold the same value.
  equals(other: RegionSize): boolean {
    return this.value === other.value;
  }

  // Each index of one side of the region: from 0 up to the size, without the size.
  *indexes(): Iterable<number> {
    for (let index = 0; index < this.value; index += 1) yield index;
  }

  // Each whole offset that is nearer to the origin than the size, in rising order.
  // A topology that grows a region around the origin reads it.
  *offsets(): Iterable<number> {
    for (let offset = 1 - this.value; offset < this.value; offset += 1)
      yield offset === 0 ? 0 : offset;
  }

  // Tells if a distance from the origin is inside the region: below the size.
  holds(distance: number): boolean {
    return distance < this.value;
  }
}
