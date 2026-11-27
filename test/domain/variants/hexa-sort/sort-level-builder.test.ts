/** @jest-environment node */
import { Color } from '../../../../src/domain/engine/color';
import { TopologyId } from '../../../../src/domain/shared/topology-id';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import { LevelDefinition } from '../../../../src/domain/progress/level-definition';
import { Moves } from '../../../../src/domain/shared/moves';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { Seed } from '../../../../src/domain/engine/seed';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import { SortLevelBuilder } from '../../../../src/domain/variants/hexa-sort/sort-level-builder';
import { SortStarThreshold } from '../../../../src/domain/variants/hexa-sort/sort-stars';
import { BOARD_ID } from '../../../support/engine/entity-ids';
import { seededRandom } from '../../../support/engine/step-random';
import { stack } from '../../../support/variants/hexa-sort/sort-game';
import {
  sortFixedSource,
  sortLevelFile,
} from '../../../support/variants/hexa-sort/sort-level-file';

// The Sort level builder builds a `SortLevel` from a level file (issue #167, classes.md decision 15).
// `LevelDefinition` directs it. The builder turns each number of the file into its value object,
// and `build()` creates the level through `seeded()` or `fixed()` and gives it its stars.

type SortFile = ReturnType<typeof sortLevelFile>;

const hexGeometry = new HexGeometry();

// The level that the hex Sort builder builds from `file`.
function built(file: Parameters<typeof LevelDefinition.of>[0]): SortLevel {
  return LevelDefinition.of(file).buildWith(new SortLevelBuilder(hexGeometry));
}

// The file of the format example with the section that `change` gives.
function withSection(change: (section: SortFile['section']) => unknown) {
  const file = sortLevelFile();
  return { ...file, section: change(file.section) };
}

// One threshold for each move count, from the first star up.
function stars(...maxMoves: number[]): SortStarThreshold[] {
  return maxMoves.map((limit) => SortStarThreshold.of(Moves.of(limit)));
}

describe('SortLevelBuilder', () => {
  // The radius 2 gives the hex region of size 3: the cells at distance 2 or less.
  it('should_build_the_seeded_level_of_the_file_when_the_definition_directs_the_builder', () => {
    const level = built(sortLevelFile());

    const expected = SortLevel.seeded(RegionSize.of(3), GoalCount.of(3), Seed.of(20261115), [
      Color.of('red'),
      Color.of('green'),
      Color.of('blue'),
    ]).withStars(stars(40, 30, 20));
    expect(level.equals(expected)).toBe(true);
  });

  // A4: a level picks its piece source, and a fixed source gives its stacks in their order.
  it('should_build_the_fixed_level_of_the_file_when_the_source_lists_its_stacks', () => {
    const level = built(withSection((section) => ({ ...section, source: sortFixedSource() })));

    const expected = SortLevel.fixed(RegionSize.of(3), GoalCount.of(3), [
      stack('red', 'red', 'blue'),
      stack('green'),
      stack('blue', 'green'),
    ]).withStars(stars(40, 30, 20));
    expect(level.equals(expected)).toBe(true);
  });

  // The board holds every cell at the radius or less from its center (DS-6).
  // On hex, the radius 2 gives 19 cells.
  it('should_give_every_cell_within_the_radius_when_the_sort_factory_builds_the_board_of_the_level', () => {
    const cells = [1, 2, 3].map((radius) => {
      const level = built(withSection((section) => ({ ...section, radius })));
      return new SortFactory(hexGeometry, level, seededRandom(1))
        .createBoard(BOARD_ID)
        .coordinates().length;
    });

    expect(cells).toEqual([7, 19, 37]);
  });

  it('should_throw_a_range_error_that_carries_the_topology_when_the_file_names_another_geometry', () => {
    const create = () => built({ ...sortLevelFile(), topology: 'square' });

    expect(create).toThrow(
      new RangeError('A Sort level builder cannot build the board of another topology.', {
        cause: { topology: TopologyId.square, geometry: hexGeometry },
      }),
    );
  });

  it('should_throw_a_range_error_that_carries_the_value_and_build_no_level_when_a_part_of_the_section_has_a_wrong_shape', () => {
    const NO_SECTION = 'The section of a Sort level needs a radius, goals, a source and stars.';
    const NO_ITEM = 'A Sort level needs one item or more in each list.';
    const BAD_RADIUS = 'The radius of a Sort level needs a whole number of 1 or more.';
    const BAD_SOURCE = 'The source of a Sort level needs a seed and colors, or stacks.';
    const BAD_COLOR = 'A color of a Sort level is a text.';
    const BAD_STAR = 'A star of a Sort level needs a move count.';
    // Each case: the part that breaks the section, the message and the value of the error.
    // A value object that refuses a value keeps its own message, and its error has no value.
    const { goals, source, stars: thresholds } = sortLevelFile().section;
    const cases: [(section: SortFile['section']) => unknown, string, unknown][] = [
      [() => 'radius', NO_SECTION, 'radius'],
      [
        (section) => ({ ...section, radius: undefined }),
        NO_SECTION,
        { goals, source, stars: thresholds },
      ],
      [(section) => ({ ...section, radius: '2' }), BAD_RADIUS, '2'],
      [(section) => ({ ...section, radius: 0 }), BAD_RADIUS, 0],
      [(section) => ({ ...section, radius: 1.5 }), BAD_RADIUS, 1.5],
      [(section) => ({ ...section, goals: '3' }), 'The goals of a Sort level need a number.', '3'],
      [
        (section) => ({ ...section, goals: 0 }),
        'A goal count needs a whole number of 1 or more, not 0.',
        undefined,
      ],
      [(section) => ({ ...section, source: 'seeded' }), BAD_SOURCE, 'seeded'],
      [(section) => ({ ...section, source: { seed: 1 } }), BAD_SOURCE, { seed: 1 }],
      [
        (section) => ({ ...section, source: { seed: '1', colors: ['red'] } }),
        BAD_SOURCE,
        { seed: '1', colors: ['red'] },
      ],
      // A source of both kinds is not one kind.
      [
        (section) => ({ ...section, source: { ...section.source, stacks: [['red']] } }),
        BAD_SOURCE,
        { ...source, stacks: [['red']] },
      ],
      [
        (section) => ({ ...section, source: { seed: -1, colors: ['red'] } }),
        'A seed must be an integer from 0 to 4294967295, not -1.',
        undefined,
      ],
      [(section) => ({ ...section, source: { seed: 1, colors: [] } }), NO_ITEM, []],
      [(section) => ({ ...section, source: { seed: 1, colors: [3] } }), BAD_COLOR, 3],
      [
        (section) => ({ ...section, source: { seed: 1, colors: [' '] } }),
        'A color needs a name.',
        undefined,
      ],
      [(section) => ({ ...section, source: { stacks: [] } }), NO_ITEM, []],
      [(section) => ({ ...section, source: { stacks: [[]] } }), NO_ITEM, []],
      [(section) => ({ ...section, source: { stacks: ['red'] } }), NO_ITEM, 'red'],
      [(section) => ({ ...section, stars: [] }), NO_ITEM, []],
      [(section) => ({ ...section, stars: [{}] }), BAD_STAR, {}],
      [(section) => ({ ...section, stars: [{ maxMoves: '4' }] }), BAD_STAR, { maxMoves: '4' }],
      [
        (section) => ({ ...section, stars: [{ maxMoves: -1 }] }),
        'A move count needs a whole number of 0 or more, not -1.',
        undefined,
      ],
    ];

    for (const [change, message, cause] of cases) {
      let level: SortLevel | undefined;

      const build = () => {
        level = built(withSection(change));
      };

      expect(build).toThrow(new RangeError(message, { cause }));
      expect(level).toBeUndefined();
    }
  });

  it('should_throw_a_range_error_when_the_builder_builds_before_it_has_a_topology_and_a_section', () => {
    const message = 'A Sort level builder needs a topology and a section.';

    expect(() => new SortLevelBuilder(hexGeometry).build()).toThrow(new RangeError(message));
    expect(() => new SortLevelBuilder(hexGeometry).withTopology(TopologyId.hex).build()).toThrow(
      new RangeError(message),
    );
    expect(() =>
      new SortLevelBuilder(hexGeometry).withSection(sortLevelFile().section).build(),
    ).toThrow(new RangeError(message));
  });
});
