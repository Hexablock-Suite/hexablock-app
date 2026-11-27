/** @jest-environment node */
import { Score } from '../../../../src/domain/shared/score';
import { TileCount } from '../../../../src/domain/variants/hexa-sort/tile-count';

// The count of tiles of one Sort stack, its height (issue #232).
// It is a whole number of 0 or more, and it gives the points of a cleared stack
// as a `Score` (issue #59, D22).

const refusal = (value: number) =>
  new RangeError(`A count of tiles needs a whole number of 0 or more, not ${value}.`);

describe('TileCount', () => {
  it('should_refuse_the_value_when_it_is_not_a_safe_integer_of_zero_or_more', () => {
    for (const value of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => TileCount.of(value)).toThrow(refusal(value));
    }
  });

  it('should_be_equal_in_both_directions_when_two_counts_hold_the_same_value', () => {
    const first = TileCount.of(11);
    const second = TileCount.of(11);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(TileCount.of(10)), TileCount.of(10).equals(first)]).toEqual([
      false,
      false,
    ]);
    expect(TileCount.of(-0).equals(TileCount.of(0))).toBe(true);
  });

  it('should_give_ten_points_for_each_tile_when_the_points_of_a_cleared_stack_are_asked', () => {
    expect(TileCount.of(0).points().equals(Score.of(0))).toBe(true);
    expect(TileCount.of(10).points().equals(Score.of(100))).toBe(true);
    expect(TileCount.of(11).points().equals(Score.of(110))).toBe(true);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `TileCount.value` is private.
      () => TileCount.of(1).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const tiles = TileCount.of(3);

    expect(Reflect.set(tiles, 'value', 4)).toBe(false);
    expect(tiles.equals(TileCount.of(3))).toBe(true);
  });
});
