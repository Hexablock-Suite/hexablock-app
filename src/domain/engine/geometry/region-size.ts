import { Distance } from './distance';
import { Radius } from './radius';

// The size of a region that a topology builds: a whole number of one or more.
// It is a value object: it never changes.
// A number above `Number.MAX_SAFE_INTEGER` is an error.
// The number stays private (classes.md decision 44, issue #206).
// A topology builds a region through the operations of the size.
// They take and give cells and a `Distance`, never a number (issue #243).
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

  // One cell for each index of one side of the region: `start`, and then one step of `axis`
  // forward per index, until the count of cells is the size.
  *indexes<T>(start: T, axis: { forward(from: T): T }): Iterable<T> {
    let reached = start;
    yield reached;
    for (let index = 1; index < this.value; index += 1) {
      reached = axis.forward(reached);
      yield reached;
    }
  }

  // Each cell of `axis` that is nearer to `origin` than the size, in order.
  // These are the offsets of the radius `size - 1`.
  // A topology that grows a region around the origin reads it.
  *offsets<T>(origin: T, axis: { forward(from: T): T; backward(from: T): T }): Iterable<T> {
    yield* Radius.of(this.value - 1).offsets(origin, axis);
  }

  // Tells if a distance from the origin is inside the region: below the size.
  holds(distance: Distance): boolean {
    return distance.isBefore(Distance.of(this.value));
  }
}
