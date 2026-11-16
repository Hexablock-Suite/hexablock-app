/** @jest-environment node */
import { Score } from '../../../src/domain/engine/score';
import { deliveries, RecordingReceiver } from '../../support/engine/value-receiver';

// The score of a game and the points of one turn (classes.md decision 41, issue #203).
// One rule for both, the rule of the backend `Score`: a safe integer of 0 or more.

const refusal = (value: number) =>
  new RangeError(`A score needs a whole number of 0 or more, not ${value}.`);

describe('Score', () => {
  it('should_accept_the_value_when_it_is_a_safe_integer_of_zero_or_more', () => {
    for (const value of [0, 1, 41, Number.MAX_SAFE_INTEGER]) {
      expect(deliveries(Score.of(value))).toEqual([value]);
    }
  });

  it('should_throw_a_range_error_when_the_value_is_not_a_number_or_is_infinite', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => Score.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_is_negative', () => {
    for (const value of [-1, -3, Number.MIN_SAFE_INTEGER]) {
      expect(() => Score.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_has_a_fraction', () => {
    for (const value of [0.5, 12.5, -12.5, Number.MIN_VALUE]) {
      expect(() => Score.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_passes_the_largest_safe_integer', () => {
    for (const value of [Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE]) {
      expect(() => Score.of(value)).toThrow(refusal(value));
    }
  });

  it('should_hold_zero_when_the_value_is_a_negative_zero', () => {
    const score = Score.of(-0);

    const [held] = deliveries(score);

    expect(Object.is(held, 0)).toBe(true);
    expect(score.equals(Score.of(0))).toBe(true);
  });

  it('should_be_equal_in_both_directions_when_two_scores_hold_the_same_value', () => {
    const first = Score.of(12);
    const second = Score.of(12);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_scores_hold_different_values', () => {
    const first = Score.of(12);
    const other = Score.of(13);

    expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
  });

  it('should_return_a_new_score_and_keep_both_scores_when_two_scores_are_added', () => {
    const total = Score.of(30);
    const points = Score.of(11);

    const sum = total.add(points);

    expect(sum).toBeInstanceOf(Score);
    expect(sum.equals(Score.of(41))).toBe(true);
    expect([total.equals(Score.of(30)), points.equals(Score.of(11))]).toEqual([true, true]);
    expect(sum).not.toBe(total);
  });

  it('should_reach_the_largest_safe_integer_when_the_sum_is_exactly_that_integer', () => {
    const sum = Score.of(Number.MAX_SAFE_INTEGER - 1).add(Score.of(1));

    expect(sum.equals(Score.of(Number.MAX_SAFE_INTEGER))).toBe(true);
  });

  it('should_throw_a_range_error_and_keep_both_scores_when_the_sum_passes_the_largest_safe_integer', () => {
    const total = Score.of(Number.MAX_SAFE_INTEGER);
    const points = Score.of(1);

    expect(() => total.add(points)).toThrow(
      new RangeError('The sum of two scores cannot pass the largest safe integer.'),
    );
    expect(() => Score.of(Number.MAX_SAFE_INTEGER).add(Score.of(Number.MAX_SAFE_INTEGER))).toThrow(
      RangeError,
    );
    expect([total.equals(Score.of(Number.MAX_SAFE_INTEGER)), points.equals(Score.of(1))]).toEqual([
      true,
      true,
    ]);
  });

  it('should_win_when_the_score_is_higher_than_the_other_score', () => {
    expect(Score.of(8).isHigherThan(Score.of(7))).toBe(true);
    expect(Score.of(7).isHigherThan(Score.of(8))).toBe(false);
  });

  it('should_not_win_when_the_two_scores_are_equal', () => {
    expect(Score.of(7).isHigherThan(Score.of(7))).toBe(false);
    expect(Score.of(0).isHigherThan(Score.of(-0))).toBe(false);
  });

  // Issue #232: a score has no product with a number. A count of the game gives its own points.
  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_multiplies_a_score_by_a_number', () => {
    const products = [
      // @ts-expect-error `Score` has no `times()` (issue #232).
      () => Score.of(20).times(3),
    ];

    expect(products).toHaveLength(1);
    expect('times' in Score.of(20)).toBe(false);
  });

  // The value leaves the object only through a receiver (issue #228).
  it('should_deliver_its_value_once_and_return_nothing_when_a_receiver_takes_it', () => {
    const receiver = new RecordingReceiver<number>();

    const returned: void = Score.of(41).deliverTo(receiver);

    expect(returned).toBeUndefined();
    expect(receiver.received()).toEqual([41]);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `Score.value` is private.
      () => Score.of(41).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const score = Score.of(5);

    expect(Reflect.set(score, 'value', 99)).toBe(false);
    expect(score.equals(Score.of(5))).toBe(true);
  });
});
