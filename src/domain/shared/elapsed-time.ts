import type { ValueReceiver } from './value-receiver';

// The time of play of one game, in milliseconds (classes.md decision 42, issue #204).
// It is a value object: it never changes, and two times are equal when their values are equal.
// An elapsed time is a safe integer of 0 or more (gap G110.2). It is the rule of the backend
// `ElapsedTime` (hexablock-api#88), so the app never keeps a time that the backend refuses.
// Any other number throws a RangeError. A negative zero is stored as 0.
// The object is frozen, so no caller writes the value.
// The value is private (issue #228). `deliverTo()` gives the number to a receiver,
// and no operation returns it. Only an adapter of the edge calls `deliverTo()`:
// the domain and the use cases call the operations.
export class ElapsedTime {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static ofMs(value: number): ElapsedTime {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `An elapsed time needs a whole number of milliseconds of 0 or more, not ${value}.`,
      );
    }
    return new ElapsedTime(value === 0 ? 0 : value);
  }

  // Two elapsed times are equal when they hold the same value.
  equals(other: ElapsedTime): boolean {
    return this.value === other.value;
  }

  // Gives the number of this elapsed time to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }

  // Tells if this time is below `other`. An equal time is not shorter.
  // Less time is the better play, as in the backend `ElapsedTime`.
  isShorterThan(other: ElapsedTime): boolean {
    return this.value < other.value;
  }
}
