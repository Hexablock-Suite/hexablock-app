import type { LevelTimerId } from './level-timer-id';

// A timed variant takes the id of a new level timer only through this interface
// (rule R-domain-determinism). Layer 4 implements it.
// It is an engine interface, not a port (classes.md decision 25).
export interface LevelTimerIdGenerator {
  // A new id on each call. Two calls never give equal ids.
  next(): LevelTimerId;
}
