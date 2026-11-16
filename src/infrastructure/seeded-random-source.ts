import type { Clock } from '../domain/engine/clock';
import { Mulberry32Random } from '../domain/engine/mulberry32-random';
import type { RandomSource } from '../domain/engine/random-source';
import { Seed } from '../domain/engine/seed';

// The count of seeds: the unsigned 32-bit integers (classes.md decision 48).
const SEEDS = 2 ** 32;

// The random driver (issue #162). It implements the engine interface `RandomSource`
// (classes.md decision 25). The same seed gives the same numbers (APP-NFR-07).
// It draws with the engine generator `Mulberry32Random`, so the app and the tests
// share one generator. The composition root draws the seed of each game from it.
export class SeededRandomSource implements RandomSource {
  private generator: RandomSource;

  constructor(private readonly seed: Seed) {
    this.generator = Mulberry32Random.from(seed);
  }

  // A source whose seed is the reading of `clock`, so each run of the app gets other numbers.
  // The driver is an adapter of the edge, so it receives the number of the reading
  // through `deliverTo()` (issue #238).
  // The reading becomes a whole number of 0 to 4294967295 first,
  // so a large, a negative or a fractional reading gives a valid seed.
  static fromClock(clock: Clock): SeededRandomSource {
    let ms = 0;
    clock.now().deliverTo({
      receive: (value) => {
        ms = value;
      },
    });
    const whole = Math.floor(ms) % SEEDS;
    return new SeededRandomSource(Seed.of((whole + SEEDS) % SEEDS));
  }

  // A number in [0, 1).
  next(): number {
    return this.generator.next();
  }

  // A copy with the same seed and the same generator state.
  // Neither copy changes the other (Prototype, classes.md decision 7).
  clone(): SeededRandomSource {
    const copy = new SeededRandomSource(this.seed);
    copy.generator = this.generator.clone();
    return copy;
  }
}
