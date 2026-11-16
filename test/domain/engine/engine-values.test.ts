/** @jest-environment node */
import { Area } from '../../../src/domain/engine/area';
import { Distance } from '../../../src/domain/engine/distance';
import { GeneratorState } from '../../../src/domain/engine/generator-state';
import { RandomDraw } from '../../../src/domain/engine/random-draw';
import { UndoLimit } from '../../../src/domain/engine/undo-limit';
import { delivered } from '../../support/engine/value-receiver';

// Issue #243: the value objects that replace the last primitives of the engine signatures.
// Each one checks its number in its factory method and keeps the number private.

describe('RandomDraw', () => {
  it('should_throw_a_range_error_when_a_draw_is_not_a_number_from_0_up_to_1', () => {
    const bad = [-0.1, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const value of bad) {
      expect(() => RandomDraw.of(value)).toThrow(
        new RangeError(`A random draw must be a number from 0 up to 1, not ${value}.`),
      );
    }
  });

  it('should_pick_the_item_at_the_place_of_the_draw_when_a_list_is_given', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(RandomDraw.of(0).pick(items)).toBe('a');
    expect(RandomDraw.of(0.25).pick(items)).toBe('b');
    expect(RandomDraw.of(0.999).pick(items)).toBe('d');
    expect(RandomDraw.of(0.999).pick(['only'])).toBe('only');
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should_throw_a_range_error_when_a_draw_picks_from_an_empty_list', () => {
    expect(() => RandomDraw.of(0.5).pick([])).toThrow(
      new RangeError('A draw needs one item or more to pick from.'),
    );
  });

  it('should_be_equal_when_two_draws_hold_the_same_number', () => {
    expect(RandomDraw.of(0.5)).not.toBe(RandomDraw.of(0.5));
    expect(RandomDraw.of(0.5).equals(RandomDraw.of(0.5))).toBe(true);
    expect(RandomDraw.of(0.5).equals(RandomDraw.of(0.25))).toBe(false);
    expect(RandomDraw.of(-0).equals(RandomDraw.of(0))).toBe(true);
  });

  it('should_come_before_another_draw_when_its_number_is_lower', () => {
    expect(RandomDraw.of(0.25).isBefore(RandomDraw.of(0.5))).toBe(true);
    expect(RandomDraw.of(0.5).isBefore(RandomDraw.of(0.25))).toBe(false);
    expect(RandomDraw.of(0.5).isBefore(RandomDraw.of(0.5))).toBe(false);
  });

  it('should_give_its_number_to_the_receiver_when_the_draw_is_delivered', () => {
    expect(delivered(RandomDraw.of(0.25))).toBe(0.25);
    expect(Object.is(delivered(RandomDraw.of(-0)), 0)).toBe(true);
  });
});

describe('GeneratorState', () => {
  it('should_throw_a_range_error_when_a_state_is_not_a_whole_number_from_0_to_4294967295', () => {
    const bad = [
      -1,
      4294967296,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      2 ** 53,
    ];
    for (const value of bad) {
      expect(() => GeneratorState.of(value)).toThrow(
        new RangeError(`A generator state must be an integer from 0 to 4294967295, not ${value}.`),
      );
    }
  });

  // The Mulberry32 generator from the state 7. The numbers are the ones that the generator
  // gave before issue #243, so the same seed still gives the same game.
  it('should_give_the_mulberry32_draws_when_the_state_advances', () => {
    const first = GeneratorState.of(7).advanced();
    const second = first.advanced();

    expect(first.equals(GeneratorState.of(1831565820))).toBe(true);
    expect(second.equals(GeneratorState.of(3663131633))).toBe(true);
    expect(delivered(first.draw())).toBe(0.011704753153026104);
    expect(delivered(second.draw())).toBe(0.06195825757458806);
    expect(delivered(second.advanced().draw())).toBe(0.97690763277933);
  });

  it('should_wrap_around_when_the_largest_state_advances', () => {
    expect(GeneratorState.of(4294967295).advanced().equals(GeneratorState.of(1831565812))).toBe(
      true,
    );
  });

  it('should_be_equal_when_two_states_hold_the_same_number', () => {
    expect(GeneratorState.of(7).equals(GeneratorState.of(7))).toBe(true);
    expect(GeneratorState.of(7).equals(GeneratorState.of(8))).toBe(false);
    expect(GeneratorState.of(-0).equals(GeneratorState.of(0))).toBe(true);
  });
});

describe('Area', () => {
  it('should_throw_a_range_error_when_an_area_is_not_a_whole_number_of_one_or_more', () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => Area.of(value)).toThrow(
        new RangeError(`An area needs a whole number of one or more, not ${value}.`),
      );
    }
  });

  it('should_give_the_sum_and_keep_both_areas_when_two_areas_are_added', () => {
    const two = Area.of(2);
    const three = Area.of(3);

    expect(two.plus(three).equals(Area.of(5))).toBe(true);
    expect(two.equals(Area.of(2))).toBe(true);
    expect(three.equals(Area.of(3))).toBe(true);
  });

  it('should_be_equal_when_two_areas_hold_the_same_count', () => {
    expect(Area.of(2).equals(Area.of(2))).toBe(true);
    expect(Area.of(2).equals(Area.of(3))).toBe(false);
  });
});

describe('Distance', () => {
  it('should_throw_a_range_error_when_a_distance_is_not_a_whole_number_of_zero_or_more', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => Distance.of(value)).toThrow(
        new RangeError(`A distance needs a whole number of zero or more, not ${value}.`),
      );
    }
  });

  it('should_be_equal_when_two_distances_hold_the_same_count', () => {
    expect(Distance.of(2).equals(Distance.of(2))).toBe(true);
    expect(Distance.of(2).equals(Distance.of(3))).toBe(false);
    expect(Distance.of(-0).equals(Distance.of(0))).toBe(true);
  });

  it('should_come_before_another_distance_when_it_is_shorter', () => {
    expect(Distance.of(1).isBefore(Distance.of(2))).toBe(true);
    expect(Distance.of(2).isBefore(Distance.of(1))).toBe(false);
    expect(Distance.of(2).isBefore(Distance.of(2))).toBe(false);
  });
});

describe('UndoLimit', () => {
  it('should_throw_a_range_error_when_a_limit_is_not_a_whole_number_of_one_or_more', () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => UndoLimit.of(value)).toThrow(
        new RangeError(`An undo limit needs a whole number of one or more, not ${value}.`),
      );
    }
  });

  it('should_keep_the_newest_items_and_leave_the_list_unchanged_when_a_list_is_over_the_limit', () => {
    const items = ['a', 'b', 'c'];

    expect(UndoLimit.of(2).newestOf(items)).toEqual(['b', 'c']);
    expect(UndoLimit.of(1).newestOf(items)).toEqual(['c']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('should_keep_every_item_when_a_list_is_within_the_limit', () => {
    expect(UndoLimit.of(3).newestOf(['a', 'b'])).toEqual(['a', 'b']);
    expect(UndoLimit.of(1).newestOf([])).toEqual([]);
  });

  it('should_be_equal_when_two_limits_hold_the_same_count', () => {
    expect(UndoLimit.of(1).equals(UndoLimit.of(1))).toBe(true);
    expect(UndoLimit.of(1).equals(UndoLimit.of(2))).toBe(false);
  });
});

describe('the value objects of issue #243', () => {
  it('should_refuse_a_write_when_a_caller_changes_a_value_object', () => {
    const values = [
      RandomDraw.of(0.5),
      GeneratorState.of(7),
      Area.of(2),
      Distance.of(2),
      UndoLimit.of(1),
    ];

    for (const value of values) {
      expect(Object.isFrozen(value)).toBe(true);
      expect(Reflect.set(value, 'value', 3)).toBe(false);
    }
  });
});
