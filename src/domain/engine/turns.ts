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

  // Two turn counts are equal when they hold the same value.
  equals(other: Turns): boolean {
    return this.value === other.value;
  }

  // The same turn as a count from 0 to `rotationSteps - 1` of the topology.
  // A full turn brings a cell back to its place, so the count drops every full turn.
  // A negative count becomes the forward count that ends at the same place.
  normalized(topology: { readonly rotationSteps: number }): Turns {
    const steps = topology.rotationSteps;
    return Turns.of(((this.value % steps) + steps) % steps);
  }
}
