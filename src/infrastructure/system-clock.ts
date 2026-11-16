import type { Clock } from '../domain/engine/clock';

// The clock driver (issue #162). It implements the engine interface `Clock`
// (classes.md decision 25) with the time of the system.
// Layer 4 may read the ambient time: rule R-domain-determinism covers only layers 1 and 2.
export class SystemClock implements Clock {
  // Milliseconds since 1970-01-01T00:00:00Z.
  now(): number {
    return Date.now();
  }
}
