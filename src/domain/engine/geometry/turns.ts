// A count of rotation steps: any whole number, never a fraction.
// A negative count turns the other way. It is a value object: it never changes.
// A count outside the safe integer range is an error. A negative zero is stored as 0.
// The number stays private. A caller adds, reduces and applies a count through its operations.
export class Turns {
  private constructor(private readonly value: number) {}

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

  // The sum of two counts. Neither count changes.
  plus(other: Turns): Turns {
    return Turns.of(this.value + other.value);
  }

  // The same turn as a count that is shorter than the full turn of the topology.
  // A full turn brings a cell back to its place, so the count drops every full turn.
  // A negative count becomes the forward count that ends at the same place.
  normalized(topology: { fullTurn(): Turns }): Turns {
    const steps = topology.fullTurn().value;
    return Turns.of(((this.value % steps) + steps) % steps);
  }

  // Turns `start` on a topology. `step` is one rotation step of that topology.
  // The count is normalized first, so `step` runs fewer times than the full turn has steps.
  applyTo<T>(start: T, step: (from: T) => T, topology: { fullTurn(): Turns }): T {
    const steps = this.normalized(topology).value;
    let turned = start;
    for (let done = 0; done < steps; done += 1) turned = step(turned);
    return turned;
  }

  // Each count from 0 up to this count, without this count.
  // For the full turn of a topology, these are its distinct turns.
  *shorter(): Iterable<Turns> {
    for (let count = 0; count < this.value; count += 1) yield Turns.of(count);
  }
}
