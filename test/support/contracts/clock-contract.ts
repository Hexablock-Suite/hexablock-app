import type { Clock } from '../../../src/domain/engine/clock';
import { ClockReading } from '../../../src/domain/engine/clock-reading';
import { delivered } from '../engine/value-receiver';

// The contract of the engine interface `Clock` (classes.md decision 25, issues #162 and #238).
// The test fake and every adapter of the interface run the same suite.
// `make()` gives a new clock for each test. A test reads the number of a reading
// through `deliverTo()`, as an adapter of the edge does.
export function describeClockContract(name: string, make: () => Clock): void {
  describe(`${name} as a Clock`, () => {
    it('should_give_a_clock_reading_of_a_finite_number_of_milliseconds_when_the_clock_is_read', () => {
      const reading = make().now();

      expect(reading).toBeInstanceOf(ClockReading);
      expect(Number.isFinite(delivered(reading))).toBe(true);
    });

    it('should_not_go_back_when_the_clock_is_read_twice', () => {
      const clock = make();

      const first = clock.now();
      const second = clock.now();

      expect(delivered(second)).toBeGreaterThanOrEqual(delivered(first));
    });
  });
}
