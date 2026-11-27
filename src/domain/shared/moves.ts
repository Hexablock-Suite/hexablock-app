import type { ValueReceiver } from './value-receiver';

// The move count of one play (classes.md decision 42, issue #204).
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A move count is a safe integer of 0 or more (gap G110.1). It is the rule of the backend `Moves`
// (hexablock-api#88), so the app never keeps a count that the backend refuses.
// Any other number throws a RangeError. NaN fails every comparison, so an unchecked NaN
// wins every star (issue #137). A negative zero is stored as 0.
// Each operation returns a new `Moves`. The object is frozen, so no caller writes the value.
// The value is private (issue #228). `deliverTo()` gives the number to a receiver,
// and no operation returns it. Only an adapter of the edge calls `deliverTo()`:
// the domain and the use cases call the operations.
export class Moves {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Moves {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A move count needs a whole number of 0 or more, not ${value}.`);
    }
    return new Moves(value === 0 ? 0 : value);
  }

  // Two move counts are equal when they hold the same value.
  equals(other: Moves): boolean {
    return this.value === other.value;
  }

  // Gives the number of this move count to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }

  // Tells if this count is below `other`. An equal count is not fewer.
  // Fewer moves is the better play, as in the backend `Moves`.
  isFewerThan(other: Moves): boolean {
    return this.value < other.value;
  }

  // The count after one more move. This count does not change.
  // A count above the largest safe integer is not exact, so it throws a RangeError.
  plusOne(): Moves {
    return Moves.of(this.value + 1);
  }
}
