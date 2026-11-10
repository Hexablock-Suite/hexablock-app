import type { Seed } from './seed';

// A capability of statement §3.2: the object takes its randomness from a known seed,
// so a test or a replay gets the same game again.
export interface IRandomSeeded {
  readonly seed: Seed;
}
