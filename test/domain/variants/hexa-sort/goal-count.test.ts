/** @jest-environment node */
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';

// Issue #129: the goal of a Sort level is a value object, not a bare number.
// The decision on #129 sets its range: a safe integer of 1 or more, with no upper bound.

describe('GoalCount', () => {
  it('should_keep_the_value_when_the_goal_is_a_whole_number_of_one_or_more', () => {
    expect(GoalCount.of(1).value).toBe(1);
    expect(GoalCount.of(5).value).toBe(5);
    expect(GoalCount.of(Number.MAX_SAFE_INTEGER).value).toBe(Number.MAX_SAFE_INTEGER);
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
});
