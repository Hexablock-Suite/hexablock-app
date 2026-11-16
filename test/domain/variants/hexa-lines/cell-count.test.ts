/** @jest-environment node */
import { Score } from '../../../../src/domain/engine/score';
import { CellCount } from '../../../../src/domain/variants/hexa-lines/cell-count';

// The count of cells that one Lines placement put on the board (issue #232).
// It is a whole number of 0 or more, and it gives its points as a `Score` (issue #59, D22).

const refusal = (value: number) =>
  new RangeError(`A count of placed cells needs a whole number of 0 or more, not ${value}.`);

describe('CellCount', () => {
  it('should_refuse_the_value_when_it_is_not_a_safe_integer_of_zero_or_more', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => CellCount.of(value)).toThrow(refusal(value));
    }
  });

  it('should_be_equal_in_both_directions_when_two_counts_hold_the_same_value', () => {
    const first = CellCount.of(2);
    const second = CellCount.of(2);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(CellCount.of(3)), CellCount.of(3).equals(first)]).toEqual([false, false]);
    expect(CellCount.of(-0).equals(CellCount.of(0))).toBe(true);
  });

  it('should_give_one_point_for_each_cell_when_the_points_are_asked', () => {
    expect(CellCount.of(0).points().equals(Score.of(0))).toBe(true);
    expect(CellCount.of(1).points().equals(Score.of(1))).toBe(true);
    expect(CellCount.of(4).points().equals(Score.of(4))).toBe(true);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `CellCount.value` is private.
      () => CellCount.of(1).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const cells = CellCount.of(1);

    expect(Reflect.set(cells, 'value', 4)).toBe(false);
    expect(cells.equals(CellCount.of(1))).toBe(true);
  });
});
