/** @jest-environment node */
import { SystemClock } from '../../src/infrastructure/system-clock';
import { describeClockContract } from '../support/contracts/clock-contract';
import { ManualClock } from '../support/engine/manual-clock';

// Issue #162: the clock driver runs the contract suite of `Clock`, the same suite as the fake.
describeClockContract('ManualClock (test fake)', () => new ManualClock());
describeClockContract('SystemClock', () => new SystemClock());

describe('SystemClock', () => {
  it('should_read_the_time_of_the_system_when_the_clock_is_read', () => {
    const before = Date.now();
    const reading = new SystemClock().now();
    const after = Date.now();

    expect(reading).toBeGreaterThanOrEqual(before);
    expect(reading).toBeLessThanOrEqual(after);
  });
});
