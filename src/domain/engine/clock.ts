import type { ClockReading } from './clock-reading';

// The engine reads time only through this interface (rule R-domain-determinism).
// Layer 4 implements it. It is an engine interface, not a port (classes.md decision 25).
export interface Clock {
  // One reading of the clock. Only the time between two readings counts (issue #238).
  now(): ClockReading;
}
