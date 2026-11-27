import { Score } from '../../shared/score';

// The combo factor of one Hexa Lines placement (issue #427): the multiplier of the line bonus.
// The accepted rule of issue #59 (D22) gives it as `lines + streak - 1`.
// So one line with streak 1 gives factor 1, and the line bonus counts once.
// It is a value object: it never changes, and two factors are equal when their values are equal.
// A factor is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// A clearing placement has a streak of 1 or more, so its factor is 1 or more.
// The formula gives 0 only for a photo that no game makes: one line with a streak of 0.
// The value is private, and no operation returns it (rule R-domain-private-fields).
// `Streak.comboFactor()` builds it from the lines, and `LineCount.comboBonus()` applies it.
export class ComboFactor {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): ComboFactor {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A combo factor needs a whole number of 0 or more, not ${value}.`);
    }
    return new ComboFactor(value === 0 ? 0 : value);
  }

  // Two factors are equal when they hold the same value.
  equals(other: ComboFactor): boolean {
    return this.value === other.value;
  }

  // The factor of a combo inside a streak: `lines + streak - 1` (D22).
  // This factor is the factor of the combo in a streak of 1, which is `lines`.
  // `oneLine` is the factor of one line in the streak, which is `streak`.
  // Neither factor changes. A sum below 0 throws a RangeError: no line in a streak of 0.
  inStreak(oneLine: ComboFactor): ComboFactor {
    return ComboFactor.of(this.value + oneLine.value - 1);
  }

  // The points that this factor adds to `bonus`, a line bonus that the base policy gives once.
  // So the factor adds the bonus `factor - 1` more times. Factor 1 adds nothing.
  // A score has no product with a number (issue #232), so the factor adds the bonus once per step.
  // Factor 0 would take the bonus away, and a score is never negative, so it throws a RangeError
  // for a bonus above 0. No game makes that photo: a clearing placement has a streak of 1 or more.
  extraOn(bonus: Score): Score {
    if (this.value === 0 && !bonus.equals(Score.of(0))) {
      throw new RangeError('A combo factor of 0 cannot take a line bonus away.');
    }
    let extra = Score.of(0);
    for (let step = 1; step < this.value; step += 1) extra = extra.add(bonus);
    return extra;
  }
}
