/** @jest-environment node */
import { RandomDraw } from '../../../../src/domain/engine/random-draw';
import { Chance } from '../../../../src/domain/variants/hexa-merge/chance';

// The chance of a 4 is a value object (issue 210, the decision comment of 2026-11-10).
// It holds a number from 0 to 1, and it says whether a draw hits.
// A draw is the `RandomDraw` of the engine (issue #243), which replaced the Merge `Draw` of #232.

describe('Chance', () => {
  it('should_throw_a_range_error_when_the_chance_is_not_a_number_from_0_to_1', () => {
    const bad = [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const value of bad) {
      expect(() => Chance.of(value)).toThrow(
        new RangeError(`The chance of a 4 must be a number from 0 to 1, not ${value}.`),
      );
    }
  });

  it('should_be_equal_when_two_chances_hold_the_same_value', () => {
    expect(Chance.of(0.1)).not.toBe(Chance.of(0.1));
    expect([Chance.of(0.1).equals(Chance.of(0.1)), Chance.of(0.1).equals(Chance.of(0.2))]).toEqual([
      true,
      false,
    ]);
    expect(Chance.of(0).equals(Chance.of(-0))).toBe(true);
    expect(Chance.of(0).equals(Chance.of(1))).toBe(false);
  });

  it('should_hit_when_the_draw_is_below_the_chance', () => {
    const chance = Chance.of(0.1);
    const hits = (draw: number) => chance.hits(RandomDraw.of(draw));

    expect([hits(0), hits(0.0999), hits(0.1), hits(0.9)]).toEqual([true, true, false, false]);
  });

  it('should_never_hit_or_always_hit_when_the_chance_is_a_limit_of_the_range', () => {
    // A draw is a number from 0 up to 1, so it is never 1.
    const draws = [0, 0.5, 0.999999].map((draw) => RandomDraw.of(draw));

    expect(draws.map((draw) => Chance.of(0).hits(draw))).toEqual([false, false, false]);
    expect(draws.map((draw) => Chance.of(1).hits(draw))).toEqual([true, true, true]);
  });

  it('should_be_above_the_other_chance_when_its_value_is_higher', () => {
    expect(Chance.of(0.2).isAbove(Chance.of(0.1))).toBe(true);
    expect(Chance.of(0.1).isAbove(Chance.of(0.1))).toBe(false);
    expect(Chance.of(0.1).isAbove(Chance.of(0.2))).toBe(false);
  });

  it('should_refuse_a_write_when_a_caller_changes_the_chance', () => {
    const chance = Chance.of(0.1);

    expect(Object.isFrozen(chance)).toBe(true);
    expect(Reflect.set(chance, 'value', 1)).toBe(false);
    expect(chance.equals(Chance.of(0.1))).toBe(true);
  });
});
