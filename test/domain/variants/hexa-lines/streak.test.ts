/** @jest-environment node */
import { Score } from '../../../../src/domain/shared/score';
import { ComboFactor } from '../../../../src/domain/variants/hexa-lines/combo-factor';
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

  // The combo multiplier is `lines + streak - 1` (issue #59, D22). The streak builds it
  // as a `ComboFactor` from the lines (issue #427).
  it('should_build_the_factor_lines_plus_streak_minus_one_when_the_streak_builds_the_combo_factor', () => {
    const factor = (streak: number, lines: number) =>
      Streak.of(streak).comboFactor(LineCount.of(lines));

    expect(factor(1, 1).equals(ComboFactor.of(1))).toBe(true);
    expect(factor(2, 1).equals(ComboFactor.of(2))).toBe(true);
    expect(factor(1, 2).equals(ComboFactor.of(2))).toBe(true);
    expect(factor(2, 2).equals(ComboFactor.of(3))).toBe(true);
  });

  // The points of issue #232 stay: the line count applies the factor that the streak builds.
  it('should_give_the_combo_bonus_of_the_lines_when_the_line_count_applies_the_factor_of_the_streak', () => {
    const bonus = (streak: number, lines: number) =>
      LineCount.of(lines).comboBonus(Streak.of(streak).comboFactor(LineCount.of(lines)));

    expect(bonus(1, 1).equals(Score.of(0))).toBe(true);
    expect(bonus(2, 1).equals(Score.of(10))).toBe(true);
    expect(bonus(1, 2).equals(Score.of(20))).toBe(true);
    expect(bonus(2, 2).equals(Score.of(40))).toBe(true);
  });

  // A clearing placement has a streak of 1 or more, so a streak of 0 is a photo that no game
  // makes. The formula still holds for it, as before issue #427: one line gives factor 0, whose
  // bonus throws, two lines give factor 1, and no line gives -1, which throws.
  it('should_keep_the_formula_of_the_factor_when_the_photo_has_a_streak_of_zero', () => {
    const bonus = (lines: number) =>
      LineCount.of(lines).comboBonus(Streak.of(0).comboFactor(LineCount.of(lines)));

    expect(() => bonus(1)).toThrow(RangeError);
    expect(bonus(2).equals(Score.of(0))).toBe(true);
    expect(bonus(3).equals(Score.of(30))).toBe(true);
    expect(() => Streak.of(0).comboFactor(LineCount.of(0))).toThrow(RangeError);
  });

  // A streak is not a count of lines (issue #427).
  it('should_reject_at_compile_time_when_a_caller_asks_the_streak_for_the_old_combo_bonus', () => {
    const bonuses = [
      // @ts-expect-error The streak builds a `ComboFactor`, and `LineCount` applies it.
      () => Streak.of(1).comboBonus(LineCount.of(1)),
    ];

    expect(bonuses).toHaveLength(1);
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
