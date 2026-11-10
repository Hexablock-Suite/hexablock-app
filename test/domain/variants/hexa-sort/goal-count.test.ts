/** @jest-environment node */
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';

// Issue #129: the goal of a Sort level is a value object, not a bare number.
// The decision on #129 sets its range: a safe integer of 1 or more, with no upper bound.

describe('GoalCount', () => {
  it('should_keep_the_value_when_the_goal_is_a_whole_number_of_one_or_more', () => {
    // The goal shows its value through its operations: the field is private.
    const reachedAt = (goal: number) => [
      GoalCount.of(goal).isReachedBy(goal - 1),
      GoalCount.of(goal).isReachedBy(goal),
    ];

    expect(reachedAt(1)).toEqual([false, true]);
    expect(reachedAt(5)).toEqual([false, true]);
    expect(reachedAt(Number.MAX_SAFE_INTEGER)).toEqual([false, true]);
    expect(GoalCount.of(5).equals(GoalCount.of(5))).toBe(true);
    expect(GoalCount.of(5).equals(GoalCount.of(6))).toBe(false);
  });

  it('should_throw_a_range_error_when_the_goal_is_below_one_or_not_a_safe_integer', () => {
    const bad = [
      0,
      -0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      2 ** 53,
    ];
    for (const value of bad) {
      expect(() => GoalCount.of(value)).toThrow(
        new RangeError(`A goal count needs a whole number of 1 or more, not ${value}.`),
      );
    }
  });

  // The goal owns the comparison, so the rules do not read its number.
  it('should_be_reached_when_the_goals_done_are_the_goal_or_more', () => {
    const goal = GoalCount.of(3);

    expect(goal.isReachedBy(2)).toBe(false);
    expect(goal.isReachedBy(3)).toBe(true);
    expect(goal.isReachedBy(4)).toBe(true);
    expect(GoalCount.of(1).isReachedBy(0)).toBe(false);
  });
});
