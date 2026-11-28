import { AchievementCount } from '../../achievements/achievement-count';
import { Score } from '../../shared/score';
import type { ValueReceiver } from '../../shared/value-receiver';
import { ComboFactor } from './combo-factor';

// The points of each cleared line, before any multiplier.
// The value codes the accepted rule of issue #59 (D22, 2026-11-06).
const POINTS_PER_LINE = 10;

// The count of lines that one Hexa Lines placement cleared: the combo of the placement
// (statement §1.1, issue #232). D24 of `docs/REQUIREMENTS.md` counts each distinct full line once.
// The team accepted D24 on 2026-11-16 (#58).
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A count of lines is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private, and no operation returns it: the count gives its points as a `Score`,
// and the count of the achievements as an `AchievementCount` (issue #406).
// `deliverTo()` gives the number to an adapter of the edge.
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

  // The count of lines as a count of the achievements. `LinesCleared` keeps it as the best
  // count of Hexa Lines, the most lines at once (issue #406).
  asAchievementCount(): AchievementCount {
    return AchievementCount.of(this.value);
  }

  // True when the placement cleared no line.
  isNone(): boolean {
    return this.value === 0;
  }

  // The line bonus: `POINTS_PER_LINE` for each cleared line, before any multiplier.
  bonus(): Score {
    return Score.of(this.value * POINTS_PER_LINE);
  }

  // The combo factor of these lines in a streak of 1: the count of lines (D22, issue #427).
  // `Streak.comboFactor()` adds the rest of the streak to it.
  comboFactor(): ComboFactor {
    return ComboFactor.of(this.value);
  }

  // The points that the combo factor `factor` adds to the line bonus (issue #59, D22).
  // The base policy gives the line bonus once, so the factor adds it `factor - 1` more times.
  // A placement that clears no line has a bonus of 0, so it adds nothing.
  // Factor 0 comes only from one line in a streak of 0, a photo that no game makes.
  // It takes the line bonus away once, so `Score.of()` refuses the negative points.
  comboBonus(factor: ComboFactor): Score {
    if (factor.equals(ComboFactor.of(0))) return Score.of(-this.value * POINTS_PER_LINE);
    return factor.extraOn(this.bonus());
  }
}
