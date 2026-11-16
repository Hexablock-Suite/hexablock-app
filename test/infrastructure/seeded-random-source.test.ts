/** @jest-environment node */
import type { Clock } from '../../src/domain/engine/clock';
import { Mulberry32Random } from '../../src/domain/engine/mulberry32-random';
import type { RandomSource } from '../../src/domain/engine/random-source';
import { Seed } from '../../src/domain/engine/seed';
import { SeededRandomSource } from '../../src/infrastructure/seeded-random-source';
import { describeRandomSourceContract } from '../support/contracts/random-source-contract';
import { delivered } from '../support/engine/value-receiver';

// Issue #162: the random driver runs the contract suite of `RandomSource`,
// the same suite as the engine generator.
describeRandomSourceContract('Mulberry32Random (engine generator)', () =>
  Mulberry32Random.from(Seed.of(7)),
);
describeRandomSourceContract('SeededRandomSource', () => new SeededRandomSource(Seed.of(7)));

// A clock that always reads `ms`.
function clockAt(ms: number): Clock {
  return { now: () => ms };
}

// The numbers of the first three draws of a source (issue #243).
function firstThree(source: RandomSource): number[] {
  return [source.next(), source.next(), source.next()].map((draw) => delivered(draw));
}

describe('SeededRandomSource', () => {
  it('should_give_the_same_numbers_when_two_sources_have_one_seed', () => {
    expect(firstThree(new SeededRandomSource(Seed.of(42)))).toEqual(
      firstThree(new SeededRandomSource(Seed.of(42))),
    );
  });

  it('should_give_other_numbers_when_two_sources_have_two_seeds', () => {
    expect(firstThree(new SeededRandomSource(Seed.of(42)))).not.toEqual(
      firstThree(new SeededRandomSource(Seed.of(43))),
    );
  });

  it('should_take_its_seed_from_the_reading_when_it_starts_from_a_clock', () => {
    const first = firstThree(SeededRandomSource.fromClock(clockAt(5000)));

    expect(firstThree(SeededRandomSource.fromClock(clockAt(5000)))).toEqual(first);
    expect(firstThree(SeededRandomSource.fromClock(clockAt(5001)))).not.toEqual(first);
  });

  it('should_start_from_a_valid_seed_when_the_clock_reads_a_large_negative_or_fractional_time', () => {
    const readings = [1_763_164_800_000, -3, 12.75];

    const draws = readings.map((ms) => delivered(SeededRandomSource.fromClock(clockAt(ms)).next()));

    expect(draws.filter((n) => !(n >= 0 && n < 1))).toEqual([]);
  });
});
