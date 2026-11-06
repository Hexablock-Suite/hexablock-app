// A count of rotation steps: any whole number, never a fraction.
// A negative count turns the other way. It is a value object: it never changes.
// A count outside the safe integer range is an error. A negative zero is stored as 0.
export class Turns {
  private constructor(readonly value: number) {}

  static of(value: number): Turns {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`A turn count needs a whole number, not ${value}.`);
    }
    return new Turns(value === 0 ? 0 : value);
  }
}
