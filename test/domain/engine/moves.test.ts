/** @jest-environment node */
import { Moves } from '../../../src/domain/engine/moves';
import { deliveries, RecordingReceiver } from '../../support/engine/value-receiver';

// The move count of one play (classes.md decision 42, issue #204).
// The rule of the backend `Moves` (hexablock-api#88): a safe integer of 0 or more.

const refusal = (value: number) =>
  new RangeError(`A move count needs a whole number of 0 or more, not ${value}.`);

describe('Moves', () => {
  it('should_accept_the_value_when_it_is_a_safe_integer_of_zero_or_more', () => {
    for (const value of [0, 1, 41, Number.MAX_SAFE_INTEGER]) {
      expect(deliveries(Moves.of(value))).toEqual([value]);
    }
  });

  it('should_throw_a_range_error_when_the_value_is_negative', () => {
    for (const value of [-1, -3, Number.MIN_SAFE_INTEGER]) {
      expect(() => Moves.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_has_a_fraction', () => {
    for (const value of [0.5, 2.5, -2.5, Number.MIN_VALUE]) {
      expect(() => Moves.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_is_not_a_number_or_is_infinite', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => Moves.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_passes_the_largest_safe_integer', () => {
    for (const value of [2 ** 53, Number.MAX_VALUE]) {
      expect(() => Moves.of(value)).toThrow(refusal(value));
    }
  });

  it('should_hold_zero_when_the_value_is_a_negative_zero', () => {
    const moves = Moves.of(-0);

    const [held] = deliveries(moves);

    expect(Object.is(held, 0)).toBe(true);
    expect(moves.equals(Moves.of(0))).toBe(true);
  });

  it('should_be_equal_in_both_directions_when_two_counts_hold_the_same_value', () => {
    const first = Moves.of(12);
    const second = Moves.of(12);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_counts_hold_different_values', () => {
    const first = Moves.of(12);
    const second = Moves.of(13);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  it('should_be_fewer_when_the_count_is_below_the_other_count', () => {
    expect(Moves.of(9).isFewerThan(Moves.of(10))).toBe(true);
    expect(Moves.of(10).isFewerThan(Moves.of(10))).toBe(false);
    expect(Moves.of(11).isFewerThan(Moves.of(10))).toBe(false);
  });

  it('should_give_a_new_count_of_one_more_when_one_move_is_added', () => {
    const before = Moves.of(4);

    const after = before.plusOne();

    expect(after.equals(Moves.of(5))).toBe(true);
    expect(before.equals(Moves.of(4))).toBe(true);
  });

  it('should_throw_a_range_error_when_one_move_is_added_to_the_largest_safe_integer', () => {
    const most = Moves.of(Number.MAX_SAFE_INTEGER);

    expect(() => most.plusOne()).toThrow(refusal(2 ** 53));
  });

  // The value leaves the object only through a receiver (issue #228).
  it('should_deliver_its_value_once_and_return_nothing_when_a_receiver_takes_it', () => {
    const receiver = new RecordingReceiver<number>();

    const returned: void = Moves.of(41).deliverTo(receiver);

    expect(returned).toBeUndefined();
    expect(receiver.received()).toEqual([41]);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `Moves.value` is private.
      () => Moves.of(41).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const moves = Moves.of(3);

    expect(Reflect.set(moves, 'value', 4)).toBe(false);
    expect(moves.equals(Moves.of(3))).toBe(true);
  });
});
