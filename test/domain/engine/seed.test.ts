/** @jest-environment node */
import { Mulberry32Random } from '../../../src/domain/engine/mulberry32-random';
import { SeededPieceSource } from '../../../src/domain/engine/piece-source';
import type { RandomSource } from '../../../src/domain/engine/random-source';
import { Seed } from '../../../src/domain/engine/seed';

// The seed of a game is a value object (issue 210, classes.md decision 48).
// It holds a whole number from 0 to 4294967295, and it is the one place that checks the range.

const numbers = (random: RandomSource, count: number) =>
  Array.from({ length: count }, () => random.next());

describe('Seed', () => {
  it('should_throw_a_range_error_when_the_seed_is_not_a_whole_number_from_0_to_4294967295', () => {
    const bad = [
      1.5,
      -1,
      4294967296,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      2 ** 53,
    ];
    for (const value of bad) {
      expect(() => Seed.of(value)).toThrow(
        new RangeError(`A seed must be an integer from 0 to 4294967295, not ${value}.`),
      );
    }
  });

  it('should_be_equal_when_two_seeds_hold_the_same_value', () => {
    expect(Seed.of(42)).not.toBe(Seed.of(42));
    expect([Seed.of(42).equals(Seed.of(42)), Seed.of(42).equals(Seed.of(43))]).toEqual([
      true,
      false,
    ]);
    // The two limits of the range are seeds. A negative zero is the seed 0.
    expect(Seed.of(0).equals(Seed.of(-0))).toBe(true);
    expect(Seed.of(4294967295).equals(Seed.of(0xffffffff))).toBe(true);
    expect(Seed.of(0).equals(Seed.of(4294967295))).toBe(false);
  });

  it('should_refuse_a_write_when_a_caller_changes_the_seed', () => {
    const seed = Seed.of(7);

    expect(Object.isFrozen(seed)).toBe(true);
    expect(Reflect.set(seed, 'value', 8)).toBe(false);
    expect(seed.equals(Seed.of(7))).toBe(true);
  });

  it('should_give_the_same_numbers_when_two_generators_start_from_equal_seeds', () => {
    const one = numbers(Mulberry32Random.from(Seed.of(7)), 20);

    expect(numbers(Mulberry32Random.from(Seed.of(7)), 20)).toEqual(one);
    expect(numbers(Mulberry32Random.from(Seed.of(8)), 20)).not.toEqual(one);
    expect(numbers(Mulberry32Random.from(Seed.of(-0)), 20)).toEqual(
      numbers(Mulberry32Random.from(Seed.of(0)), 20),
    );
  });

  it('should_draw_the_same_pieces_when_two_sources_start_from_equal_seeds', () => {
    const draw = (random: RandomSource) => Math.floor(random.next() * 1000);
    const first = (seed: Seed) => {
      const pieces: number[] = [];
      for (const piece of new SeededPieceSource(seed, draw)) {
        pieces.push(piece);
        if (pieces.length === 20) break;
      }
      return pieces;
    };

    expect(first(Seed.of(42))).toEqual(first(Seed.of(42)));
    expect(first(Seed.of(42))).not.toEqual(first(Seed.of(43)));
    expect(new SeededPieceSource(Seed.of(42), draw).seed.equals(Seed.of(42))).toBe(true);
  });
});
