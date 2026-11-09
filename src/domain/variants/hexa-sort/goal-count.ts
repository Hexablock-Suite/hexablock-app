import { Range } from '../../engine/range';

// The goal counts that a level can ask: 1 or more. No source names an upper bound,
// so the bound is the largest safe integer (decision on issue #129).
const GOAL_COUNTS = Range.ofNumbers(1, Number.MAX_SAFE_INTEGER);

// The goal of one Hexa Sort level: the count of stacks that the player must clear to win.
// It is a value object: it never changes (issue #129, gaps G108.1 and G116.5).
// A goal of 0 wins before the first move, and NaN never wins, so `of()` rejects both.
// Any number that is not a safe integer of 1 or more throws a RangeError.
export class GoalCount {
  private constructor(readonly value: number) {}

  static of(value: number): GoalCount {
    if (!Number.isSafeInteger(value) || !GOAL_COUNTS.contains(value)) {
      throw new RangeError(`A goal count needs a whole number of 1 or more, not ${value}.`);
    }
    return new GoalCount(value);
  }

  // Two goal counts are equal when they hold the same value.
  equals(other: GoalCount): boolean {
    return this.value === other.value;
  }
}
