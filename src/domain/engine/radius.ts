// The distance of a ring from its center: a whole number of zero or more.
// Radius 0 gives the center. It is a value object: it never changes.
// A number above `Number.MAX_SAFE_INTEGER` is an error. A negative zero is stored as 0.
// The number stays private (classes.md decision 44, issue #206).
// A topology builds a ring through the operations of the radius.
export class Radius {
  private constructor(private readonly value: number) {}

  static of(value: number): Radius {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A radius needs a whole number of zero or more, not ${value}.`);
    }
    return new Radius(value === 0 ? 0 : value);
  }

  // Two radii are equal when they hold the same value.
  equals(other: Radius): boolean {
    return this.value === other.value;
  }

  // Each whole offset from minus the radius to the radius, in rising order.
  // A topology turns two offsets into a coordinate with its factory.
  *offsets(): Iterable<number> {
    for (let offset = -this.value; offset <= this.value; offset += 1)
      yield offset === 0 ? 0 : offset;
  }

  // Tells if a distance is exactly this radius.
  measures(distance: number): boolean {
    return distance === this.value;
  }

  // Runs `step` once for each unit of the radius, from `start`. Radius 0 gives `start`.
  expand<T>(start: T, step: (from: T) => T): T {
    let reached = start;
    for (let unit = 0; unit < this.value; unit += 1) reached = step(reached);
    return reached;
  }
}
