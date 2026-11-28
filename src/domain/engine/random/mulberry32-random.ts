import type { GeneratorState } from './generator-state';
import type { RandomDraw } from './random-draw';
import type { RandomSource } from './random-source';
import type { Seed } from './seed';

// A random source that a seed fixes (APP-NFR-07): the same seed gives the same draws.
// It uses the Mulberry32 generator: pure 32-bit integer arithmetic, no ambient randomness.
// `from()` starts the generator from a `Seed`. The seed checks its own range
// (classes.md decision 48), so the generator makes no check.
// The state is a `GeneratorState`, which holds the Mulberry32 arithmetic (issue #243).
// `next()` moves to the next state and gives its draw.
// `clone()` copies the generator state. It does not replay the draws.
export class Mulberry32Random implements RandomSource {
  private constructor(private state: GeneratorState) {}

  static from(seed: Seed): Mulberry32Random {
    return new Mulberry32Random(seed.generatorState());
  }

  next(): RandomDraw {
    this.state = this.state.advanced();
    return this.state.draw();
  }

  // A state never changes, so the copy shares it.
  clone(): Mulberry32Random {
    return new Mulberry32Random(this.state);
  }
}
