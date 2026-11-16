/** @jest-environment node */
import { Range } from '../../../src/domain/engine/range';
import { Rank } from '../../support/engine/rank';

// Issue #129: a generic closed interval for the limits between value objects.
// Issue #239: `T` is a value object that knows its order, so no order is a number.

const ranks = (...positions: number[]) => positions.map((position) => Rank.of(position));

describe('Range', () => {
  it('should_contain_the_value_when_it_lies_between_the_bounds_inclusive', () => {
    const range = Range.of(Rank.of(3), Rank.of(32));

    expect(ranks(3, 4, 31, 32).map((rank) => range.contains(rank))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('should_not_contain_the_value_when_it_lies_outside_the_bounds', () => {
    const range = Range.of(Rank.of(3), Rank.of(32));

    expect(ranks(2, 33, -1000, 1000).map((rank) => range.contains(rank))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('should_contain_only_the_bound_when_min_equals_max', () => {
    const range = Range.of(Rank.of(5), Rank.of(5));

    expect(ranks(4, 5, 6).map((rank) => range.contains(rank))).toEqual([false, true, false]);
  });

  // The order of `T` decides: a value that shares a place with a bound lies inside.
  it('should_contain_the_value_when_it_shares_a_place_with_a_bound_but_is_another_object', () => {
    const range = Range.of(Rank.of(8), Rank.of(128));

    expect(ranks(8, 128).map((rank) => range.contains(rank))).toEqual([true, true]);
    expect(range.equals(Range.of(Rank.of(8), Rank.of(128)))).toBe(true);
    expect(range.equals(Range.of(Rank.of(8), Rank.of(127)))).toBe(false);
    expect(range.equals(Range.of(Rank.of(9), Rank.of(128)))).toBe(false);
  });

  it('should_throw_a_range_error_when_min_comes_after_max', () => {
    expect(() => Range.of(Rank.of(5), Rank.of(4))).toThrow(
      new RangeError('A Range needs min <= max.'),
    );
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_builds_a_range_of_numbers', () => {
    // @ts-expect-error `Range` has no factory method for numbers.
    expect(() => Range.ofNumbers(1, 5)).toThrow(TypeError);
    // @ts-expect-error A number has no `isBefore()`, so it is no bound of a range.
    expect(() => Range.of(1, 5)).toThrow(TypeError);
  });
});
