import type { RandomSource } from './random-source';
import type { Seed } from './seed';

// A random source that a seed fixes (APP-NFR-07): the same seed gives the same numbers.
// It uses the Mulberry32 generator: pure 32-bit integer arithmetic, no ambient randomness.
// `from()` starts the generator from a `Seed`. The seed checks its own range
// (classes.md decision 48), so the generator makes no check.
// `clone()` copies the generator state. It does not replay the numbers.
export class Mulberry32Random implements RandomSource {
  private constructor(private state: number) {}

  static from(seed: Seed): Mulberry32Random {
    return new Mulberry32Random(seed.generatorState());
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  clone(): Mulberry32Random {
    return new Mulberry32Random(this.state);
  }
}
