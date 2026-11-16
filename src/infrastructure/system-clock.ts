import type { Clock } from '../domain/engine/clock';
import { ClockReading } from '../domain/engine/clock-reading';

// The clock driver (issue #162). It implements the engine interface `Clock`
// (classes.md decision 25) with the time of the system.
// Layer 4 may read the ambient time: rule R-domain-determinism covers only layers 1 and 2.
// The driver builds the `ClockReading` of each reading (issue #238).
export class SystemClock implements Clock {
  // A reading in milliseconds since 1970-01-01T00:00:00Z.
  now(): ClockReading {
    return ClockReading.of(Date.now());
  }
}
