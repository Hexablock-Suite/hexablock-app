import { Score } from '../../shared/score';
import type { ValueReceiver } from '../../shared/value-receiver';

// The points of each cleared line, before any multiplier.
// The value codes the accepted rule of issue #59 (D22, 2026-11-06).
const POINTS_PER_LINE = 10;

// The count of lines that one Hexa Lines placement cleared: the combo of the placement
// (statement §1.1, issue #232). The proposal on issue 58 counts each distinct full line once.
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A count of lines is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private, and no operation returns it: the count gives its points as a `Score`.
// `deliverTo()` gives the number to an adapter of the edge: the counter of the achievements
// keeps the most lines at once (issue #363).
export class LineCount {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): LineCount {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `A count of cleared lines needs a whole number of 0 or more, not ${value}.`,
      );
    }
    return new LineCount(value === 0 ? 0 : value);
  }

  // Two counts are equal when they hold the same value.
  equals(other: LineCount): boolean {
    return this.value === other.value;
  }

  // Gives the number of lines to `receiver`. It returns nothing.
  // No code of the domain or of the use cases calls it (rule R-no-delivery-call).
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }

  // True when the placement cleared no line.
  isNone(): boolean {
    return this.value === 0;
  }

  // The line bonus: `POINTS_PER_LINE` for each cleared line, before any multiplier.
  bonus(): Score {
    return Score.of(this.value * POINTS_PER_LINE);
  }

  // The points that the combo multiplier adds to the line bonus (issue #59, D22).
  // The multiplier is `lines + streak - 1`. The base policy gives the line bonus once,
  // so the combo adds it `multiplier - 1` more times. A placement that clears no line adds nothing.
  // `streak` is the length of the streak as a count, because the multiplier adds it to the count
  // of lines. `Streak.comboBonus()` gives it, so no number leaves either value object.
  // A clearing placement has a streak of 1 or more. A streak of 0 gives a negative product,
  // and `Score.of()` throws a RangeError.
  comboBonus(streak: LineCount): Score {
    if (this.isNone()) return Score.of(0);
    return Score.of(this.value * POINTS_PER_LINE * (this.value + streak.value - 2));
  }
}
