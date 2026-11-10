/** @jest-environment node */
import { Range } from '../../../src/domain/engine/range';

// Issue #129: a generic closed interval for the two-sided limits of the domain.
// It mirrors the `Range<T>` of hexablock-api, with the same API and message.

describe('Range', () => {
  it('should_contain_the_value_when_it_lies_between_the_bounds_inclusive', () => {
    const range = Range.ofNumbers(3, 32);

    expect([3, 4, 31, 32].map((value) => range.contains(value))).toEqual([true, true, true, true]);
  });

  it('should_not_contain_the_value_when_it_lies_outside_the_bounds_or_is_not_a_number', () => {
    const range = Range.ofNumbers(3, 32);

    for (const value of [2, 33, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(range.contains(value)).toBe(false);
    }
  });

  it('should_contain_an_infinite_value_when_the_upper_bound_is_infinite', () => {
    const range = Range.ofNumbers(0, Number.POSITIVE_INFINITY);

    expect(range.contains(Number.POSITIVE_INFINITY)).toBe(true);
    expect(range.contains(-1)).toBe(false);
  });

  it('should_keep_the_bounds_when_a_range_is_created', () => {
    const range = Range.ofNumbers(8, 128);

    expect(range.equals(Range.ofNumbers(8, 128))).toBe(true);
    expect(range.equals(Range.ofNumbers(8, 127))).toBe(false);
    expect(range.equals(Range.ofNumbers(9, 128))).toBe(false);
    expect([7, 8, 128, 129].map((value) => range.contains(value))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it('should_contain_only_the_bound_when_min_equals_max', () => {
    const range = Range.ofNumbers(5, 5);

    expect([4, 5, 6].map((value) => range.contains(value))).toEqual([false, true, false]);
  });

  it('should_contain_negative_zero_when_zero_is_a_bound', () => {
    expect(Range.ofNumbers(0, 1).contains(-0)).toBe(true);
    expect(Range.ofNumbers(-1, 0).contains(-0)).toBe(true);
  });

  it('should_throw_a_range_error_when_min_is_greater_than_max_or_a_bound_is_not_a_number', () => {
    for (const [min, max] of [
      [5, 4],
      [Number.NaN, 4],
      [1, Number.NaN],
    ] as const) {
      expect(() => Range.ofNumbers(min, max)).toThrow(new RangeError('A Range needs min <= max.'));
    }
  });

  it('should_order_the_values_with_the_compare_function_when_the_bounds_are_not_numbers', () => {
    const byLength = (left: string, right: string) => left.length - right.length;
    const range = Range.of<string>('ab', 'abcd', byLength);

    expect(range.contains('xyz')).toBe(true);
    expect(range.contains('x')).toBe(false);
    expect(range.contains('xyzzy')).toBe(false);
    expect(() => Range.of('abcd', 'ab', byLength)).toThrow(
      new RangeError('A Range needs min <= max.'),
    );
  });
});
