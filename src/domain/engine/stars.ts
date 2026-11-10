// The stars of one won level (classes.md decision 42, issue #204).
// It is a value object: it never changes, and two star counts are equal when their values are equal.
// A star count is a safe integer of 0 or more. It is the rule of the backend `Stars`
// (hexablock-api#88), so the app never keeps a star count that the backend refuses.
// Any other number throws a RangeError. A negative zero is stored as 0.
// The object is frozen, so no caller writes the value.
// `value` stays readable, as in the backend `Stars`. The name of the operation that gives
// the number to an adapter is an open question (README table «Primitive types»).
// Only an adapter of the edge reads `value`: the domain and the use cases call the operations.
export class Stars {
  private constructor(readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Stars {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A star count needs a whole number of 0 or more, not ${value}.`);
    }
    return new Stars(value === 0 ? 0 : value);
  }

  // Two star counts are equal when they hold the same value.
  equals(other: Stars): boolean {
    return this.value === other.value;
  }
}
