/** @jest-environment node */
import { Color } from '../../../../src/domain/engine/color';
import { SeededPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import type { ColorStack } from '../../../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import { names, stack } from '../../../support/variants/hexa-sort/sort-game';

// A Sort level is a value object that holds the data of its piece source:
// the seed, or the fixed list of stacks (issue 209, classes.md decision 47).

const SIZE = RegionSize.of(2);
const GOAL = GoalCount.of(3);
const red = Color.of('red');
const blue = Color.of('blue');
const green = Color.of('green');

function fixed(...stacks: ColorStack[]): SortLevel {
  return SortLevel.fixed(SIZE, GOAL, stacks);
}

// The stacks that a new source of the level gives first, as color names.
function firstStacks(level: SortLevel, count: number): string[][] {
  const found: string[][] = [];
  let source = new SortFactory(new SquareGeometry(), level).createPieceSource();
  while (found.length < count && source.hasNext()) {
    const { piece, rest } = source.take();
    found.push(names(piece.content));
    source = rest;
  }
  return found;
}

describe('SortLevel', () => {
  it('should_be_equal_when_two_levels_hold_the_same_data', () => {
    const one = fixed(stack('red', 'blue'), stack('green'));
    const other = fixed(stack('red', 'blue'), stack('green'));
    const seeded = SortLevel.seeded(SIZE, GOAL, 7, [red, blue]);
    const sameSeeded = SortLevel.seeded(RegionSize.of(2), GoalCount.of(3), 7, [
      Color.of('red'),
      Color.of('blue'),
    ]);

    expect(one).not.toBe(other);
    expect(one.equals(other)).toBe(true);
    expect(other.equals(one)).toBe(true);
    expect(seeded.equals(sameSeeded)).toBe(true);
    expect(sameSeeded.equals(seeded)).toBe(true);
  });

  it('should_not_be_equal_when_two_levels_differ_in_one_part', () => {
    const level = fixed(stack('red', 'blue'), stack('green'));
    const others = [
      SortLevel.fixed(RegionSize.of(3), GOAL, [stack('red', 'blue'), stack('green')]),
      SortLevel.fixed(SIZE, GoalCount.of(4), [stack('red', 'blue'), stack('green')]),
      fixed(stack('red', 'blue')),
      fixed(stack('red', 'blue'), stack('blue')),
      // The source gives the stacks in the order of the level, so the order counts.
      fixed(stack('green'), stack('red', 'blue')),
      SortLevel.seeded(SIZE, GOAL, 7, [red, blue]),
    ];

    for (const other of others) {
      expect(level.equals(other)).toBe(false);
      expect(other.equals(level)).toBe(false);
    }
  });

  it('should_not_be_equal_when_two_seeded_levels_differ_in_the_seed_or_the_colors', () => {
    const level = SortLevel.seeded(SIZE, GOAL, 7, [red, blue]);
    const others = [
      SortLevel.seeded(SIZE, GOAL, 8, [red, blue]),
      SortLevel.seeded(SIZE, GOAL, 7, [red]),
      SortLevel.seeded(SIZE, GOAL, 7, [red, green]),
      // A draw picks a color by its place in the list, so the order counts.
      SortLevel.seeded(SIZE, GOAL, 7, [blue, red]),
    ];

    for (const other of others) {
      expect(level.equals(other)).toBe(false);
      expect(other.equals(level)).toBe(false);
    }
  });

  it('should_throw_the_range_error_of_the_seeded_source_when_the_seed_is_outside_0_to_4294967295', () => {
    for (const seed of [-1, 4294967296, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const message = `A seed must be an integer from 0 to 4294967295, not ${seed}.`;

      expect(() => new SeededPieceSource(seed, () => stack('red'))).toThrow(
        new RangeError(message),
      );
      expect(() => SortLevel.seeded(SIZE, GOAL, seed, [red])).toThrow(new RangeError(message));
    }
  });

  it('should_build_the_level_when_the_seed_is_at_a_limit_of_the_range', () => {
    for (const seed of [0, 4294967295]) {
      const level = SortLevel.seeded(SIZE, GOAL, seed, [red]);

      expect(level.equals(SortLevel.seeded(SIZE, GOAL, seed, [red]))).toBe(true);
      expect(firstStacks(level, 2)).toEqual([['red'], ['red']]);
    }
  });

  it('should_throw_a_range_error_when_a_seeded_level_gets_no_color_or_an_undefined_color', () => {
    // Only a cast or a sparse list gives these lists, as a broken level file would.
    const none = [] as unknown as [Color];
    const sparse = [red, undefined] as unknown as [Color];

    expect(() => SortLevel.seeded(SIZE, GOAL, 7, none)).toThrow(
      new RangeError('A seeded Sort level needs one color or more.'),
    );
    expect(() => SortLevel.seeded(SIZE, GOAL, 7, sparse)).toThrow(
      new RangeError('A piece list cannot hold undefined.'),
    );
  });

  it('should_throw_a_range_error_when_the_level_stacks_hold_undefined', () => {
    // Only a cast or a sparse list puts `undefined` in the stacks, as a broken level file would.
    const stacks = [stack('red'), undefined] as unknown as ColorStack[];

    expect(() => SortLevel.fixed(SIZE, GOAL, stacks)).toThrow(
      new RangeError('A piece list cannot hold undefined.'),
    );
  });

  it('should_keep_its_data_when_the_arrays_that_built_the_level_change', () => {
    const stacks = [stack('red')];
    const colors: [Color, ...Color[]] = [red];
    const level = SortLevel.fixed(SIZE, GOAL, stacks);
    const seeded = SortLevel.seeded(SIZE, GOAL, 7, colors);

    stacks.push(stack('green'));
    stacks[0] = stack('blue');
    colors[0] = blue;

    expect(firstStacks(level, 5)).toEqual([['red']]);
    expect(level.equals(fixed(stack('red')))).toBe(true);
    expect(firstStacks(seeded, 3)).toEqual([['red'], ['red'], ['red']]);
    expect(seeded.equals(SortLevel.seeded(SIZE, GOAL, 7, [red]))).toBe(true);
  });

  it('should_refuse_a_write_when_a_caller_changes_the_level', () => {
    const level = fixed(stack('red'));

    expect(Object.isFrozen(level)).toBe(true);
    expect(Reflect.set(level, 'goalsNeeded', GoalCount.of(1))).toBe(false);
    expect(Reflect.set(level, 'supply', { stacks: [] })).toBe(false);
    expect(level.equals(fixed(stack('red')))).toBe(true);
  });

  it('should_draw_one_tile_of_a_level_color_when_a_seeded_level_gives_a_stack', () => {
    const level = SortLevel.seeded(SIZE, GOAL, 42, [red, blue, green]);

    const stacks = firstStacks(level, 30);

    expect(stacks).toHaveLength(30);
    for (const tiles of stacks) {
      expect(tiles).toHaveLength(1);
      expect(['red', 'blue', 'green']).toContain(tiles[0]);
    }
    // The seed fixes the sequence, and a sequence of 30 draws holds each color.
    expect(new Set(stacks.map((tiles) => tiles[0])).size).toBe(3);
    expect(firstStacks(SortLevel.seeded(SIZE, GOAL, 42, [red, blue, green]), 30)).toEqual(stacks);
    expect(firstStacks(SortLevel.seeded(SIZE, GOAL, 43, [red, blue, green]), 30)).not.toEqual(
      stacks,
    );
  });
});
