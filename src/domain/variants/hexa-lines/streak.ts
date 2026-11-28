import { ComboFactor } from './combo-factor';
import type { LineCount } from './line-count';

// The streak of Hexa Lines: the count of placements in a row that cleared at least one line
// (statement §1.1, D24 of `docs/REQUIREMENTS.md`, issue #232).
// The team accepted D24 on 2026-11-16 (#58).
// It is a value object: it never changes, and two streaks are equal when their values are equal.
// A streak is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private, and no operation returns it.
export class Streak {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Streak {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A streak needs a whole number of 0 or more, not ${value}.`);
    }
    return new Streak(value === 0 ? 0 : value);
  }

  // Two streaks are equal when they hold the same value.
  equals(other: Streak): boolean {
    return this.value === other.value;
  }

  // The streak after one more placement that cleared `lines`. This streak does not change.
  // A placement that clears a line makes the streak one placement longer.
  // A placement that clears no line sets it back to 0.
  // A streak above the largest safe integer is not exact, so it throws a RangeError.
  after(lines: LineCount): Streak {
    return lines.isNone() ? Streak.of(0) : Streak.of(this.value + 1);
  }

  // The combo factor of a placement that cleared `lines` in this streak (issue #59, D22):
  // `lines + streak - 1`. The lines give the factor of their combo in a streak of 1,
  // and the streak gives the factor of one line in it, its length (issue #427).
  // A placement that clears no line in a streak of 0 gives -1, so it throws a RangeError.
  // `ComboMultiplierDecorator` asks only for a placement that clears a line.
  comboFactor(lines: LineCount): ComboFactor {
    return lines.comboFactor().inStreak(ComboFactor.of(this.value));
  }
}
