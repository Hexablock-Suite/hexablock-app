// The area of a shape: its count of cells, a whole number of one or more (issue #243).
// It is a value object: it never changes, and two areas are equal when their counts are equal.
// `of()` is the only place that checks the count. A count above `Number.MAX_SAFE_INTEGER`
// is an error. The count stays private. A shape adds areas with `plus()`.
export class Area {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Area {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`An area needs a whole number of one or more, not ${value}.`);
    }
    return new Area(value);
  }

  // Two areas are equal when they hold the same count.
  equals(other: Area): boolean {
    return this.value === other.value;
  }

  // The area of two shapes together. Neither area changes.
  plus(other: Area): Area {
    return Area.of(this.value + other.value);
  }
}
