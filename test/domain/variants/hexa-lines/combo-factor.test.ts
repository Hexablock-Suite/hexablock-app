/** @jest-environment node */
import { Score } from '../../../../src/domain/shared/score';
import { ComboFactor } from '../../../../src/domain/variants/hexa-lines/combo-factor';

// The combo factor of one Hexa Lines placement (issue #427): the multiplier of the line bonus,
// `lines + streak - 1` by the rule of issue #59 (D22). It is a whole number of 0 or more.

const refusal = (value: number) =>
  new RangeError(`A combo factor needs a whole number of 0 or more, not ${value}.`);

describe('ComboFactor', () => {
  it('should_refuse_the_value_when_it_is_not_a_safe_integer_of_zero_or_more', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => ComboFactor.of(value)).toThrow(refusal(value));
    }
    expect(ComboFactor.of(-0).equals(ComboFactor.of(0))).toBe(true);
  });

  it('should_be_equal_in_both_directions_when_two_factors_hold_the_same_value', () => {
    const first = ComboFactor.of(2);
    const second = ComboFactor.of(2);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(ComboFactor.of(3)), ComboFactor.of(3).equals(first)]).toEqual([
      false,
      false,
    ]);
  });

  // The factor of the combo in a streak of 1 is `lines`, and the factor of one line
  // in the streak is `streak`. Together they give `lines + streak - 1`.
  it('should_give_lines_plus_streak_minus_one_when_a_combo_factor_meets_the_factor_of_one_line_in_the_streak', () => {
    const factor = (lines: number, streak: number) =>
      ComboFactor.of(lines).inStreak(ComboFactor.of(streak));

    expect(factor(1, 1).equals(ComboFactor.of(1))).toBe(true);
    expect(factor(2, 1).equals(ComboFactor.of(2))).toBe(true);
    expect(factor(1, 2).equals(ComboFactor.of(2))).toBe(true);
    expect(factor(2, 2).equals(ComboFactor.of(3))).toBe(true);
    expect(factor(3, 4).equals(ComboFactor.of(6))).toBe(true);
    // A streak of 0 has no clearing placement: the formula still gives `lines - 1`.
    expect(factor(2, 0).equals(ComboFactor.of(1))).toBe(true);
    expect(() => factor(0, 0)).toThrow(refusal(-1));
  });

  // The base policy gives the line bonus once, so the factor adds it `factor - 1` more times.
  it('should_add_the_bonus_factor_minus_one_times_when_the_factor_applies_to_a_line_bonus', () => {
    const extra = (factor: number, bonus: number) =>
      ComboFactor.of(factor).extraOn(Score.of(bonus));

    expect(extra(1, 20).equals(Score.of(0))).toBe(true);
    expect(extra(2, 10).equals(Score.of(10))).toBe(true);
    expect(extra(3, 20).equals(Score.of(40))).toBe(true);
    expect(extra(5, 0).equals(Score.of(0))).toBe(true);
    expect(extra(0, 0).equals(Score.of(0))).toBe(true);
  });

  // Factor 0 comes only from one line in a streak of 0, a photo that no game makes.
  // A score is never negative, so the factor refuses to take the line bonus away.
  it('should_throw_a_range_error_when_a_factor_of_zero_applies_to_a_line_bonus', () => {
    expect(() => ComboFactor.of(0).extraOn(Score.of(10))).toThrow(
      new RangeError('A combo factor of 0 cannot take a line bonus away.'),
    );
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `ComboFactor.value` is private.
      () => ComboFactor.of(1).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const factor = ComboFactor.of(2);

    expect(Reflect.set(factor, 'value', 4)).toBe(false);
    expect(factor.equals(ComboFactor.of(2))).toBe(true);
  });
});
