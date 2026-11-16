import type { Clock } from '../../../src/domain/engine/clock';

// The contract of the engine interface `Clock` (classes.md decision 25, issue #162).
// The test fake and every adapter of the interface run the same suite.
// `make()` gives a new clock for each test.
export function describeClockContract(name: string, make: () => Clock): void {
  describe(`${name} as a Clock`, () => {
    it('should_give_a_finite_number_of_milliseconds_when_the_clock_is_read', () => {
      expect(Number.isFinite(make().now())).toBe(true);
    });

    it('should_not_go_back_when_the_clock_is_read_twice', () => {
      const clock = make();

      const first = clock.now();
      const second = clock.now();

      expect(second).toBeGreaterThanOrEqual(first);
    });
  });
}
