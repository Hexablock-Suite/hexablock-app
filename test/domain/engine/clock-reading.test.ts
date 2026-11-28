/** @jest-environment node */
import { ClockReading } from '../../../src/domain/engine/turn/clock-reading';
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import { deliveries, delivered, RecordingReceiver } from '../../support/engine/value-receiver';

// One reading of the engine `Clock` (issue #238, classes.md decisions 19 and 25).
// One reading alone means nothing: only the time between two readings counts.

const refusal = (value: number) =>
  new RangeError(`A clock reading needs a finite number of milliseconds, not ${value}.`);

// The milliseconds from the reading `from` to the reading `to`.
const msBetween = (from: number, to: number) =>
  delivered(ClockReading.of(to).elapsedSince(ClockReading.of(from)));

describe('ClockReading', () => {
  it('should_give_the_time_between_two_readings_when_the_later_reading_is_after_the_earlier_one', () => {
    const passed = ClockReading.of(1_005_000).elapsedSince(ClockReading.of(1_000_000));

    expect(passed).toBeInstanceOf(ElapsedTime);
    expect(passed.equals(ElapsedTime.ofMs(5_000))).toBe(true);
    expect(msBetween(1_000_000, 1_000_000)).toBe(0);
  });

  it('should_give_an_elapsed_time_of_zero_when_the_clock_goes_back', () => {
    expect(msBetween(1_000_000, 999_000)).toBe(0);
    expect(msBetween(11, 10.5)).toBe(0);
    expect(msBetween(3, -3)).toBe(0);
  });

  it('should_drop_the_fraction_of_a_millisecond_when_the_time_between_two_readings_has_one', () => {
    expect(msBetween(1_000_000, 1_001_500.75)).toBe(1_500);
    expect(msBetween(0.25, 1)).toBe(0);
    expect(msBetween(10.5, 12.25)).toBe(1);
  });

  it('should_accept_the_reading_when_it_is_large_negative_or_fractional', () => {
    for (const value of [0, 1_763_164_800_000, -3, 12.75]) {
      expect(deliveries(ClockReading.of(value))).toEqual([value]);
    }
  });

  it('should_throw_a_range_error_when_the_reading_is_not_a_number_or_is_infinite', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => ClockReading.of(value)).toThrow(refusal(value));
    }
  });

  it('should_be_equal_in_both_directions_when_two_readings_hold_the_same_value', () => {
    const first = ClockReading.of(1_000_000);
    const second = ClockReading.of(1_000_000);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_readings_hold_different_values', () => {
    const first = ClockReading.of(1_000_000);
    const second = ClockReading.of(1_000_000.5);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  // The value leaves the object only through a receiver of layer 4 (issue #228).
  it('should_deliver_its_value_once_and_return_nothing_when_a_receiver_takes_it', () => {
    const receiver = new RecordingReceiver<number>();

    const returned: void = ClockReading.of(1_000_000).deliverTo(receiver);

    expect(returned).toBeUndefined();
    expect(receiver.received()).toEqual([1_000_000]);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `ClockReading.value` is private.
      () => ClockReading.of(1_000_000).value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const reading = ClockReading.of(3);

    expect(Reflect.set(reading, 'value', 4)).toBe(false);
    expect(reading.equals(ClockReading.of(3))).toBe(true);
  });
});
