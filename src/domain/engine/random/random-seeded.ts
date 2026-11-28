import type { Seed } from './seed';

// A capability of statement §3.2: the object takes its randomness from a known seed,
// so a test or a replay gets the same game again.
// The seed stays private. A reader asks whether the object draws from a seed (issue #234).
export interface IRandomSeeded {
  isSeededWith(seed: Seed): boolean;
}
