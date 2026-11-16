/** @jest-environment node */
import { Chance } from '../../../../src/domain/variants/hexa-merge/chance';
import { Draw } from '../../../../src/domain/variants/hexa-merge/draw';

// One draw of the Merge tile source: a number from 0 up to 1, with 1 left out,
// as a random source gives it (issue #232). A draw picks the cell of a new tile,
// and a draw falls below the chance of a 4 or not.

const refusal = (value: number) =>
  new RangeError(`A draw must be a number from 0 up to 1, not ${value}.`);

describe('Draw', () => {
  it('should_refuse_the_value_when_it_is_not_a_number_from_0_up_to_1', () => {
    const bad = [-0.1, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const value of bad) {
      expect(() => Draw.of(value)).toThrow(refusal(value));
    }
  });

  it('should_be_equal_in_both_directions_when_two_draws_hold_the_same_value', () => {
    const first = Draw.of(0.5);
    const second = Draw.of(0.5);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(Draw.of(0.25)), Draw.of(0.25).equals(first)]).toEqual([false, false]);
    expect(Draw.of(-0).equals(Draw.of(0))).toBe(true);
  });

  it('should_pick_the_item_at_its_share_of_the_list_when_a_list_is_given', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(Draw.of(0).pick(items)).toBe('a');
    expect(Draw.of(0.25).pick(items)).toBe('b');
    expect(Draw.of(0.999).pick(items)).toBe('d');
    expect(Draw.of(0.999).pick(['only'])).toBe('only');
  });

  it('should_throw_a_range_error_when_the_list_has_no_item', () => {
    expect(() => Draw.of(0.5).pick([])).toThrow(
      new RangeError('A draw needs one item or more to pick from.'),
    );
  });

  it('should_fall_below_the_chance_when_its_value_is_lower_than_the_chance', () => {
    const chance = Chance.of(0.1);

    expect([0, 0.0999, 0.1, 0.9].map((value) => Draw.of(value).isBelow(chance))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `Draw.value` is private.
      () => Draw.of(0.5).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const draw = Draw.of(0.5);

    expect(Reflect.set(draw, 'value', 0)).toBe(false);
    expect(draw.equals(Draw.of(0.5))).toBe(true);
  });
});
