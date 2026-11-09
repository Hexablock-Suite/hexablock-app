import type { Clock } from '../../../src/domain/engine/clock';

// A `Clock` that moves only when a test moves it. It exists only in test/.
// It starts far from zero, so a test cannot take a reading for a duration.
export class ManualClock implements Clock {
  private ms = 1_000_000;

  now(): number {
    return this.ms;
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}
