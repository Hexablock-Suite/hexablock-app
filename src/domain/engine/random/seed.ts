import { GeneratorState } from './generator-state';

// The largest seed of a game: the largest unsigned 32-bit integer.
const MAX_SEED = 0xffffffff;

// The seed of a match (APP-NFR-07, classes.md decision 48, issues #210 and #417): the same seed gives
// the same pieces. It is a value object: it never changes, and two seeds are equal
// when their values are equal.
// A seed is a whole number from 0 to 4294967295. Any other number throws a RangeError,
// because a generator would truncate it and two different seeds would give the same game.
// `of()` is the only place that checks the range. A negative zero is stored as 0.
// The number stays private. The settings, a level and a seeded source pass the seed on,
// and only a random generator asks for its first state, a `GeneratorState` (issue #243).
export class Seed {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Seed {
    if (!Number.isInteger(value) || value < 0 || value > MAX_SEED) {
      throw new RangeError(`A seed must be an integer from 0 to 4294967295, not ${value}.`);
    }
    return new Seed(value >>> 0);
  }

  // Two seeds are equal when they hold the same value.
  equals(other: Seed): boolean {
    return this.value === other.value;
  }

  // The first state of a generator that starts from this seed. It holds the number of the seed.
  // A random generator asks for it once, when it starts.
  generatorState(): GeneratorState {
    return GeneratorState.of(this.value);
  }
}
