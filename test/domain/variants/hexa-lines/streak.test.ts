/** @jest-environment node */
import { Score } from '../../../../src/domain/shared/score';
import { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';
import { Streak } from '../../../../src/domain/variants/hexa-lines/streak';

// The streak of Hexa Lines: the count of placements in a row that cleared at least one line
// (proposal on issue 58, issue #232). It is a whole number of 0 or more.

const refusal = (value: number) =>
  new RangeError(`A streak needs a whole number of 0 or more, not ${value}.`);

describe('Streak', () => {
  it('should_refuse_the_value_when_it_is_not_a_safe_integer_of_zero_or_more', () => {
    for (const value of [-1, 0.5, Number.NaN, Number.NEGATIVE_INFINITY, 2 ** 53]) {
      expect(() => Streak.of(value)).toThrow(refusal(value));
    }
  });

  it('should_be_equal_in_both_directions_when_two_streaks_hold_the_same_value', () => {
    const first = Streak.of(2);
    const second = Streak.of(2);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(Streak.of(3)), Streak.of(3).equals(first)]).toEqual([false, false]);
    expect(Streak.of(-0).equals(Streak.of(0))).toBe(true);
  });

  it('should_grow_by_one_when_the_placement_clears_a_line', () => {
    const before = Streak.of(1);

    expect(before.after(LineCount.of(1)).equals(Streak.of(2))).toBe(true);
    expect(before.after(LineCount.of(3)).equals(Streak.of(2))).toBe(true);
    expect(before.equals(Streak.of(1))).toBe(true);
  });

  it('should_go_back_to_zero_when_the_placement_clears_no_line', () => {
    expect(Streak.of(4).after(LineCount.of(0)).equals(Streak.of(0))).toBe(true);
    expect(Streak.of(0).after(LineCount.of(0)).equals(Streak.of(0))).toBe(true);
  });

  it('should_throw_a_range_error_when_the_streak_passes_the_largest_safe_integer', () => {
    expect(() => Streak.of(Number.MAX_SAFE_INTEGER).after(LineCount.of(1))).toThrow(
      refusal(Number.MAX_SAFE_INTEGER + 1),
    );
  });

  // The combo multiplier is `lines + streak - 1` (issue #59, D22).
  it('should_give_the_combo_bonus_of_the_lines_when_the_streak_multiplies_the_line_bonus', () => {
    expect(Streak.of(1).comboBonus(LineCount.of(1)).equals(Score.of(0))).toBe(true);
    expect(Streak.of(2).comboBonus(LineCount.of(1)).equals(Score.of(10))).toBe(true);
    expect(Streak.of(1).comboBonus(LineCount.of(2)).equals(Score.of(20))).toBe(true);
    expect(Streak.of(2).comboBonus(LineCount.of(2)).equals(Score.of(40))).toBe(true);
    expect(Streak.of(3).comboBonus(LineCount.of(0)).equals(Score.of(0))).toBe(true);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `Streak.value` is private.
      () => Streak.of(1).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const streak = Streak.of(1);

    expect(Reflect.set(streak, 'value', 4)).toBe(false);
    expect(streak.equals(Streak.of(1))).toBe(true);
  });
});
