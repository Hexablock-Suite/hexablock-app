/** @jest-environment node */
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { Seed } from '../../../../src/domain/engine/seed';
import { Chance } from '../../../../src/domain/variants/hexa-merge/chance';
import { MergeSettings } from '../../../../src/domain/variants/hexa-merge/merge-factory';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { DEFAULT_FOUR_CHANCE } from '../../../../src/domain/variants/hexa-merge/merge-tile-source';

// The settings of a Hexa Merge game are a value object (issue 210, classes.md decision 48).

const SIZE = RegionSize.of(2);
const SEED = Seed.of(7);
const TARGET = MergeTile.of(2048);

describe('MergeSettings', () => {
  it('should_be_equal_when_two_merge_settings_hold_the_same_data', () => {
    const one = MergeSettings.of(SIZE, SEED, TARGET, Chance.of(0.25));
    const other = MergeSettings.of(
      RegionSize.of(2),
      Seed.of(7),
      MergeTile.of(2048),
      Chance.of(0.25),
    );

    expect(one).not.toBe(other);
    expect([one.equals(other), other.equals(one)]).toEqual([true, true]);
  });

  it('should_not_be_equal_when_two_merge_settings_differ_in_one_part', () => {
    const settings = MergeSettings.of(SIZE, SEED, TARGET, Chance.of(0.25));
    const others = [
      MergeSettings.of(RegionSize.of(3), SEED, TARGET, Chance.of(0.25)),
      MergeSettings.of(SIZE, Seed.of(8), TARGET, Chance.of(0.25)),
      MergeSettings.of(SIZE, SEED, MergeTile.of(1024), Chance.of(0.25)),
      MergeSettings.of(SIZE, SEED, TARGET, Chance.of(0.5)),
      MergeSettings.of(SIZE, SEED, TARGET),
    ];

    for (const other of others) {
      expect([settings.equals(other), other.equals(settings)]).toEqual([false, false]);
    }
  });

  it('should_hold_the_default_chance_of_a_four_when_the_merge_settings_get_no_chance', () => {
    const settings = MergeSettings.of(SIZE, SEED, TARGET);

    expect(DEFAULT_FOUR_CHANCE.equals(Chance.of(0.1))).toBe(true);
    expect(settings.chanceOfFour().equals(Chance.of(0.1))).toBe(true);
    expect(settings.equals(MergeSettings.of(SIZE, SEED, TARGET, DEFAULT_FOUR_CHANCE))).toBe(true);
  });

  it('should_give_its_parts_when_the_factory_asks', () => {
    const settings = MergeSettings.of(SIZE, SEED, TARGET, Chance.of(0.25));

    expect(settings.boardSize().equals(RegionSize.of(2))).toBe(true);
    expect(settings.tileSeed().equals(Seed.of(7))).toBe(true);
    expect(settings.targetTile().equals(MergeTile.of(2048))).toBe(true);
    expect(settings.chanceOfFour().equals(Chance.of(0.25))).toBe(true);
  });

  it('should_throw_a_range_error_when_the_merge_settings_are_built_with_a_wrong_seed_or_chance', () => {
    // The seed and the chance check themselves, so no settings exist with a wrong one.
    expect(() => MergeSettings.of(SIZE, Seed.of(-1), TARGET)).toThrow(
      new RangeError('A seed must be an integer from 0 to 4294967295, not -1.'),
    );
    expect(() => MergeSettings.of(SIZE, SEED, TARGET, Chance.of(1.1))).toThrow(
      new RangeError('The chance of a 4 must be a number from 0 to 1, not 1.1.'),
    );
  });

  it('should_refuse_a_write_when_a_caller_changes_the_merge_settings', () => {
    const settings = MergeSettings.of(SIZE, SEED, TARGET);

    expect(Object.isFrozen(settings)).toBe(true);
    expect(Reflect.set(settings, 'seed', Seed.of(8))).toBe(false);
    expect(Reflect.set(settings, 'fourChance', Chance.of(1))).toBe(false);
    expect(settings.equals(MergeSettings.of(SIZE, SEED, TARGET))).toBe(true);
  });
});
