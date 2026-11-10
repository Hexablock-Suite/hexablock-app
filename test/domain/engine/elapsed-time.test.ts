/** @jest-environment node */
import { ElapsedTime } from '../../../src/domain/engine/elapsed-time';

// The time of play of one game, in milliseconds (classes.md decision 42, issue #204).
// The rule of the backend `ElapsedTime` (hexablock-api#88): a safe integer of 0 or more.

const refusal = (value: number) =>
  new RangeError(
    `An elapsed time needs a whole number of milliseconds of 0 or more, not ${value}.`,
  );

describe('ElapsedTime', () => {
  it('should_accept_the_value_when_it_is_a_safe_integer_of_zero_or_more', () => {
    for (const value of [0, 1, 60_000, Number.MAX_SAFE_INTEGER]) {
      expect(ElapsedTime.ofMs(value).value).toBe(value);
    }
  });

  it('should_throw_a_range_error_when_the_value_is_negative', () => {
    for (const value of [-1, -3_000, Number.MIN_SAFE_INTEGER]) {
      expect(() => ElapsedTime.ofMs(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_has_a_fraction', () => {
    for (const value of [0.5, 1_000.25, -2.5, Number.MIN_VALUE]) {
      expect(() => ElapsedTime.ofMs(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_is_not_a_number_or_is_infinite', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => ElapsedTime.ofMs(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_passes_the_largest_safe_integer', () => {
    for (const value of [2 ** 53, Number.MAX_VALUE]) {
      expect(() => ElapsedTime.ofMs(value)).toThrow(refusal(value));
    }
  });

  it('should_hold_zero_when_the_value_is_a_negative_zero', () => {
    const time = ElapsedTime.ofMs(-0);

    expect(Object.is(time.value, 0)).toBe(true);
    expect(time.equals(ElapsedTime.ofMs(0))).toBe(true);
  });

  it('should_be_equal_in_both_directions_when_two_times_hold_the_same_value', () => {
    const first = ElapsedTime.ofMs(5_000);
    const second = ElapsedTime.ofMs(5_000);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_times_hold_different_values', () => {
    const first = ElapsedTime.ofMs(5_000);
    const second = ElapsedTime.ofMs(5_001);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  it('should_be_shorter_when_the_time_is_below_the_other_time', () => {
    expect(ElapsedTime.ofMs(59_999).isShorterThan(ElapsedTime.ofMs(60_000))).toBe(true);
    expect(ElapsedTime.ofMs(60_000).isShorterThan(ElapsedTime.ofMs(60_000))).toBe(false);
    expect(ElapsedTime.ofMs(60_001).isShorterThan(ElapsedTime.ofMs(60_000))).toBe(false);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const time = ElapsedTime.ofMs(3);

    expect(Reflect.set(time, 'value', 4)).toBe(false);
    expect(time.equals(ElapsedTime.ofMs(3))).toBe(true);
  });
});
