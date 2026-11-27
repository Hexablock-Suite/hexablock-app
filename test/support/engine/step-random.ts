import { RandomDraw } from '../../../src/domain/engine/random-draw';
import type { RandomSource } from '../../../src/domain/engine/random-source';

// A random source that gives the numbers of a list in order, and starts again after the last one.
// It doubles the boundary `RandomSource` only (rule R-rules-suite). It exists only in test/.
// A list of one number is a fixed source: each draw gives that number.
// A clone starts at the position of its original, and neither one moves the other.
// A fixed source whose each draw picks the seed `seed` (issue #417): `RandomDraw.pickSeed()`
// multiplies the draw by 4294967296, and `seed / 2 ** 32` is exact for a whole seed.
// So each match of a factory with this source starts from `seed`, as a fixed seed did before.
export function seededRandom(seed: number): StepRandom {
  return new StepRandom([seed / 2 ** 32]);
}

export class StepRandom implements RandomSource {
  private position = 0;

  constructor(private readonly numbers: readonly number[]) {}

  next(): RandomDraw {
    const number = this.numbers[this.position % this.numbers.length] ?? 0;
    this.position += 1;
    return RandomDraw.of(number);
  }

  clone(): StepRandom {
    const copy = new StepRandom(this.numbers);
    copy.position = this.position;
    return copy;
  }
}
