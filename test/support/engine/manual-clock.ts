import type { Clock } from '../../../src/domain/engine/turn/clock';
import { ClockReading } from '../../../src/domain/engine/turn/clock-reading';

// A `Clock` that moves only when a test moves it. It exists only in test/.
// It starts far from zero, so a test cannot take a reading for a duration.
// Each reading is a `ClockReading`, as the engine interface asks (issue #238).
export class ManualClock implements Clock {
  private ms = 1_000_000;

  now(): ClockReading {
    return ClockReading.of(this.ms);
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}
