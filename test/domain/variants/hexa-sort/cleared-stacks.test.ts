/** @jest-environment node */
import { ClearedStacks } from '../../../../src/domain/variants/hexa-sort/cleared-stacks';
import { deliveries, RecordingReceiver } from '../../../support/engine/value-receiver';

// The count of stacks that a Sort game cleared (classes.md decision 42, issue #204).
// It is a counter: a safe integer of 0 or more, as `Moves` is.

const refusal = (value: number) =>
  new RangeError(`A count of cleared stacks needs a whole number of 0 or more, not ${value}.`);

describe('ClearedStacks', () => {
  it('should_accept_the_value_when_it_is_a_safe_integer_of_zero_or_more', () => {
    for (const value of [0, 1, 7, Number.MAX_SAFE_INTEGER]) {
      expect(deliveries(ClearedStacks.of(value))).toEqual([value]);
    }
  });

  it('should_throw_a_range_error_when_the_value_is_negative', () => {
    for (const value of [-1, -3, Number.MIN_SAFE_INTEGER]) {
      expect(() => ClearedStacks.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_has_a_fraction', () => {
    for (const value of [0.5, 1.5, -1.5, Number.MIN_VALUE]) {
      expect(() => ClearedStacks.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_is_not_a_number_or_is_infinite', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => ClearedStacks.of(value)).toThrow(refusal(value));
    }
  });

  it('should_throw_a_range_error_when_the_value_passes_the_largest_safe_integer', () => {
    for (const value of [2 ** 53, Number.MAX_VALUE]) {
      expect(() => ClearedStacks.of(value)).toThrow(refusal(value));
    }
  });

  it('should_hold_zero_when_the_value_is_a_negative_zero', () => {
    const cleared = ClearedStacks.of(-0);

    const [held] = deliveries(cleared);

    expect(Object.is(held, 0)).toBe(true);
    expect(cleared.equals(ClearedStacks.of(0))).toBe(true);
  });

  it('should_be_equal_in_both_directions_when_two_counts_hold_the_same_value', () => {
    const first = ClearedStacks.of(2);
    const second = ClearedStacks.of(2);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_counts_hold_different_values', () => {
    const first = ClearedStacks.of(2);
    const second = ClearedStacks.of(3);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  it('should_give_a_new_count_of_one_more_when_one_stack_is_added', () => {
    const before = ClearedStacks.of(1);

    const after = before.plusOne();

    expect(after.equals(ClearedStacks.of(2))).toBe(true);
    expect(before.equals(ClearedStacks.of(1))).toBe(true);
  });

  it('should_be_at_least_the_other_count_when_it_is_equal_or_higher', () => {
    expect(ClearedStacks.of(2).isAtLeast(ClearedStacks.of(3))).toBe(false);
    expect(ClearedStacks.of(3).isAtLeast(ClearedStacks.of(3))).toBe(true);
    expect(ClearedStacks.of(4).isAtLeast(ClearedStacks.of(3))).toBe(true);
  });

  // The value leaves the object only through a receiver (issue #228).
  it('should_deliver_its_value_once_and_return_nothing_when_a_receiver_takes_it', () => {
    const receiver = new RecordingReceiver<number>();

    const returned: void = ClearedStacks.of(7).deliverTo(receiver);

    expect(returned).toBeUndefined();
    expect(receiver.received()).toEqual([7]);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `ClearedStacks.value` is private.
      () => ClearedStacks.of(7).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const cleared = ClearedStacks.of(3);

    expect(Reflect.set(cleared, 'value', 4)).toBe(false);
    expect(cleared.equals(ClearedStacks.of(3))).toBe(true);
  });
});
