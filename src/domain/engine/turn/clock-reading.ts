import { ElapsedTime } from '../../shared/elapsed-time';
import type { ValueReceiver } from '../../shared/value-receiver';

// One reading of the engine `Clock` (issue #238, classes.md decisions 19 and 25).
// A reading counts milliseconds from an origin that the clock chooses. The origin is not a date,
// so one reading alone means nothing. Only the time between two readings counts.
// The name comes from the language of the game. The backend has its own time type,
// so the two repositories share no time type.
// It is a value object: it never changes, and two readings are equal when their values are equal.
// A reading is a finite number. It can be negative, and it can hold a fraction of a millisecond.
// Any other number throws a RangeError. The object is frozen, so no caller writes the value.
// The value is private. `deliverTo()` gives the number to a receiver of layer 4,
// and no operation returns it. The domain and the use cases call `elapsedSince()`.
export class ClockReading {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): ClockReading {
    if (!Number.isFinite(value)) {
      throw new RangeError(`A clock reading needs a finite number of milliseconds, not ${value}.`);
    }
    return new ClockReading(value);
  }

  // The time from the reading `earlier` to this reading, as an `ElapsedTime`.
  // A clock that goes back gives 0, because an `ElapsedTime` is never negative.
  // The time drops the fraction of a millisecond.
  elapsedSince(earlier: ClockReading): ElapsedTime {
    return ElapsedTime.ofMs(Math.max(0, Math.floor(this.value - earlier.value)));
  }

  // Two readings are equal when they hold the same value.
  equals(other: ClockReading): boolean {
    return this.value === other.value;
  }

  // Gives the number of this reading to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }
}
