/** @jest-environment node */
import { Score } from '../../../../src/domain/shared/score';
import { ComboFactor } from '../../../../src/domain/variants/hexa-lines/combo-factor';
import { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';

// The count of lines that one Lines placement cleared, the combo of the placement (issue #232).
// It is a whole number of 0 or more, and it gives its points as a `Score` (issue #59, D22).

const refusal = (value: number) =>
  new RangeError(`A count of cleared lines needs a whole number of 0 or more, not ${value}.`);

describe('LineCount', () => {
  it('should_refuse_the_value_when_it_is_not_a_safe_integer_of_zero_or_more', () => {
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => LineCount.of(value)).toThrow(refusal(value));
    }
  });

  it('should_be_equal_in_both_directions_when_two_counts_hold_the_same_value', () => {
    const first = LineCount.of(2);
    const second = LineCount.of(2);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(LineCount.of(3)), LineCount.of(3).equals(first)]).toEqual([false, false]);
    expect(LineCount.of(-0).equals(LineCount.of(0))).toBe(true);
  });

  it('should_be_none_when_the_placement_cleared_no_line', () => {
    expect(LineCount.of(0).isNone()).toBe(true);
    expect(LineCount.of(1).isNone()).toBe(false);
  });

  it('should_give_ten_points_for_each_line_when_the_line_bonus_is_asked', () => {
    expect(LineCount.of(0).bonus().equals(Score.of(0))).toBe(true);
    expect(LineCount.of(1).bonus().equals(Score.of(10))).toBe(true);
    expect(LineCount.of(3).bonus().equals(Score.of(30))).toBe(true);
  });

  // The multiplier is the combo factor `lines + streak - 1` (issue #427), and the combo adds
  // the line bonus `factor - 1` more times. The points are those of issue #232.
  it('should_add_the_line_bonus_factor_minus_one_times_when_the_combo_bonus_is_asked', () => {
    const bonus = (lines: number, streak: number) =>
      LineCount.of(lines).comboBonus(ComboFactor.of(lines + streak - 1));

    expect(bonus(1, 1).equals(Score.of(0))).toBe(true);
    expect(bonus(2, 1).equals(Score.of(20))).toBe(true);
    expect(bonus(1, 2).equals(Score.of(10))).toBe(true);
    expect(bonus(2, 2).equals(Score.of(40))).toBe(true);
  });

  it('should_add_nothing_when_the_placement_cleared_no_line_whatever_the_factor', () => {
    for (const factor of [1, 2, 4]) {
      expect(LineCount.of(0).comboBonus(ComboFactor.of(factor)).equals(Score.of(0))).toBe(true);
    }
  });

  // In a streak of 1 the combo factor is the count of lines (D22).
  it('should_give_the_count_of_lines_as_the_factor_when_the_combo_is_in_a_streak_of_one', () => {
    expect(LineCount.of(0).comboFactor().equals(ComboFactor.of(0))).toBe(true);
    expect(LineCount.of(1).comboFactor().equals(ComboFactor.of(1))).toBe(true);
    expect(LineCount.of(3).comboFactor().equals(ComboFactor.of(3))).toBe(true);
  });

  // A clearing placement has a streak of 1 or more, so a streak of 0 is a photo that no game makes.
  // One line in a streak of 0 gives factor 0, and the bonus cannot become negative.
  it('should_throw_a_range_error_when_a_clearing_placement_has_a_streak_of_zero', () => {
    expect(() => LineCount.of(1).comboBonus(ComboFactor.of(0))).toThrow(
      new RangeError('A score needs a whole number of 0 or more, not -10.'),
    );
    expect(LineCount.of(0).comboBonus(ComboFactor.of(0)).equals(Score.of(0))).toBe(true);
  });

  // A streak is not a count of lines (issue #427).
  it('should_reject_at_compile_time_when_a_caller_gives_a_count_of_lines_as_the_streak', () => {
    const bonuses = [
      // @ts-expect-error The combo bonus takes a `ComboFactor`, not a count of lines.
      () => LineCount.of(1).comboBonus(LineCount.of(1)),
    ];

    expect(bonuses).toHaveLength(1);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `LineCount.value` is private.
      () => LineCount.of(1).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const lines = LineCount.of(1);

    expect(Reflect.set(lines, 'value', 4)).toBe(false);
    expect(lines.equals(LineCount.of(1))).toBe(true);
  });
});
