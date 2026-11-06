import type { RandomSource } from './random-source';

// A random source that a seed fixes (APP-NFR-07): the same seed gives the same numbers.
// It uses the Mulberry32 generator: pure 32-bit integer arithmetic, no ambient randomness.
// The seed is an unsigned 32-bit integer. Any other number throws a RangeError,
// because `>>> 0` would truncate it and two different seeds would give the same game.
export class Mulberry32Random implements RandomSource {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError(`A seed must be an integer from 0 to 4294967295, not ${seed}.`);
    }
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
