/** @jest-environment node */
import { Stars } from '../../../src/domain/engine/stars';

// The stars of one won level (classes.md decision 42, issue #204).
// The rule of the backend `Stars` (hexablock-api#88): a safe integer of 0 or more.

const refusal = (value: number) =>
  new RangeError(`A star count needs a whole number of 0 or more, not ${value}.`);

describe('Stars', () => {
  it('should_accept_the_value_when_it_is_a_safe_integer_of_zero_or_more', () => {
    for (const value of [0, 1, 3, Number.MAX_SAFE_INTEGER]) {
      expect(Stars.of(value).value).toBe(value);
    }
  });

  it('should_throw_a_range_error_when_the_value_is_negative', () => {
    for (const value of [-1, -3, Number.MIN_SAFE_INTEGER]) {
      expect(() => Stars.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_has_a_fraction', () => {
    for (const value of [0.5, 1.5, -1.5, Number.MIN_VALUE]) {
      expect(() => Stars.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_is_not_a_number_or_is_infinite', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => Stars.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_passes_the_largest_safe_integer', () => {
    for (const value of [2 ** 53, Number.MAX_VALUE]) {
      expect(() => Stars.of(value)).toThrow(refusal(value));
    }
  });

  it('should_hold_zero_when_the_value_is_a_negative_zero', () => {
    const stars = Stars.of(-0);

    expect(Object.is(stars.value, 0)).toBe(true);
    expect(stars.equals(Stars.of(0))).toBe(true);
  });

  it('should_be_equal_in_both_directions_when_two_star_counts_hold_the_same_value', () => {
    const first = Stars.of(2);
    const second = Stars.of(2);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_star_counts_hold_different_values', () => {
    const first = Stars.of(2);
    const second = Stars.of(3);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const stars = Stars.of(3);

    expect(Reflect.set(stars, 'value', 4)).toBe(false);
    expect(stars.equals(Stars.of(3))).toBe(true);
  });
});
