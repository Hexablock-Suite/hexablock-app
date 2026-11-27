/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { GeometryFactory } from '../../../../src/domain/engine/geometry-factory';
import { LevelDefinition } from '../../../../src/domain/progress/level-definition';
import { Moves } from '../../../../src/domain/shared/moves';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Stars } from '../../../../src/domain/progress/stars';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { PlaceStack } from '../../../../src/domain/variants/hexa-sort/place-stack';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import type { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import { SortLevelBuilder } from '../../../../src/domain/variants/hexa-sort/sort-level-builder';
import { withGeometryOf } from '../../../support/engine/geometry-of';
import { startVariant } from '../../../support/engine/variant-game';
import { seededRandom } from '../../../support/engine/step-random';
import { repoRoot } from '../../../support/run-tool';
import { names } from '../../../support/variants/hexa-sort/sort-game';
import { sortLevelFile } from '../../../support/variants/hexa-sort/sort-level-file';
import { playMove } from '../../../support/engine/play-move';

// The bundled Sort levels (issue #167, APP-FR-05, A4). Each file follows the shared level format
// of hexablock-api `docs/level-format.md`. The test reads every file of the folder,
// so a new level file joins the test with no change here.
// Since #354 the folder also holds levels on the square and on the triangle. Each test reads
// a file through the geometry of the figure that its `topology` names. Each new level gives
// a fixed list of stacks, because #352 and #353 change the seeded stacks.

const folder = path.join(repoRoot, 'src/adapters/levels/sort');

// The figures of the bundled levels: the prefix of the level ids of each figure, the least count
// of levels on it, the count of cells of a board of radius r, and three cells of that board
// where no two cells are neighbors. APP-FR-05 asks for 10 Sort levels, and the hexagon holds them.
// The square and the triangle hold 3 levels each (decision of #354). Their regions grow
// from a corner: the radius r gives a side of r + 1 squares, or of r + 1 pairs of triangles.
const FIGURES: readonly {
  readonly topology: string;
  readonly prefix: string;
  readonly least: number;
  readonly cells: (radius: number) => number;
  readonly apart: readonly (readonly [number, number])[];
}[] = [
  {
    topology: 'hex',
    prefix: 'sort-',
    least: 10,
    cells: (r) => 3 * r * (r + 1) + 1,
    apart: [
      [0, 0],
      [2, 0],
      [-2, 0],
    ],
  },
  {
    topology: 'square',
    prefix: 'sort-square-',
    least: 3,
    cells: (r) => (r + 1) ** 2,
    apart: [
      [0, 0],
      [2, 0],
      [0, 2],
    ],
  },
  {
    topology: 'triangle',
    prefix: 'sort-triangle-',
    least: 3,
    cells: (r) => 2 * (r + 1) ** 2,
    apart: [
      [0, 0],
      [2, 0],
      [4, 0],
    ],
  },
];

// The fields of the level file, as the file writes them.
type SourceEntry = { seed: number; colors: string[] } | { stacks: string[][] };
type LevelFile = {
  gameId: string;
  levelId: string;
  order: number;
  version: number;
  topology: string;
  section: {
    radius: number;
    goals: number;
    source: SourceEntry;
    stars: { maxMoves: number }[];
  };
};

// Every bundled Sort level file, by its file name, in the order of the names.
function bundledFiles(): [string, LevelFile][] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as LevelFile]);
}

function built<TCoord>(file: LevelFile, geometry: GeometryFactory<TCoord>): SortLevel {
  return LevelDefinition.of(file).buildWith(new SortLevelBuilder(geometry));
}

// The figure of the topology of `file`.
function figureOf(file: LevelFile): (typeof FIGURES)[number] {
  const figure = FIGURES.find(({ topology }) => topology === file.topology);
  if (figure === undefined) throw new RangeError(`No figure has the topology ${file.topology}.`);
  return figure;
}

// The topology of each bundled file, once each, in the order of the names.
const topologiesOf = (files: [string, LevelFile][]) => [
  ...new Set(files.map(([, file]) => file.topology)),
];

// The offered stack of a new game of the level of `file`, at the start and after each
// of three placements, for each of two games that start from one built level.
// No two of the three cells are neighbors, so no run moves and no stack clears.
function offeredInTwoGames(file: LevelFile): string[][][] {
  return withGeometryOf(file.topology, {
    use: (geometry) => {
      const factory = new SortFactory(geometry, built(file, geometry), seededRandom(1));
      return [0, 1].map(() => {
        const { engine } = startVariant(factory);
        const offered = [names(engine.snapshot().offeredStack())];
        for (const at of figureOf(file).apart) {
          playMove(engine, PlaceStack.on(geometry.createCoord([...at])));
          offered.push(names(engine.snapshot().offeredStack()));
        }
        return offered;
      });
    },
  });
}

// The first photo of a new game of the level of `file`: the count of cells of its board,
// whether its goal is the goal of the file, and the names of the offered stack.
function firstPhoto(file: LevelFile): { cells: number; goal: boolean; offered: string[] } {
  return withGeometryOf(file.topology, {
    use: (geometry) => {
      const { engine } = startVariant(
        new SortFactory(geometry, built(file, geometry), seededRandom(1)),
      );
      const photo = engine.snapshot();
      return {
        cells: photo.boardCopy().coordinates().length,
        goal: photo.goal().equals(GoalCount.of(file.section.goals)),
        offered: names(photo.offeredStack()),
      };
    },
  });
}

// The outcomes of the placements of `plan` in a new game of the level of `file`,
// and the stars of a play with as many moves as the plan.
function planPlay(
  file: LevelFile,
  plan: readonly (readonly [number, number])[],
): { outcomes: Outcome[]; stars: Stars } {
  return withGeometryOf(file.topology, {
    use: (geometry) => {
      const level = built(file, geometry);
      const { engine } = startVariant(new SortFactory(geometry, level, seededRandom(1)));
      const outcomes = plan.map((at) =>
        playMove(engine, PlaceStack.on(geometry.createCoord([...at]))),
      );
      return { outcomes, stars: level.starsFor(Moves.of(plan.length)) };
    },
  });
}

// The cells where a player places the stacks of each fixed level, one cell for each move.
// Each plan clears the goals of its level with the fewest moves that its stacks allow.
const PLANS: Readonly<Record<string, readonly [number, number][]>> = {
  // The three red runs make one stack of 10 red tiles.
  'sort-02.json': [
    [0, 0],
    [1, 0],
    [-1, 0],
  ],
  // The blue runs and the red runs meet on both sides of the cell (1, 0).
  'sort-03.json': [
    [0, 0],
    [2, 0],
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 1],
  ],
  // The red run under the blue run joins the red stack when the blue run moves away.
  'sort-04.json': [
    [0, 0],
    [1, 0],
    [-1, 0],
    [2, 0],
    [-2, 0],
  ],
  // The green tiles under the red run join the green stack on the left.
  'sort-05.json': [
    [0, 0],
    [1, 0],
    [-1, 0],
    [2, 0],
    [-2, 0],
    [-1, 1],
  ],
  // The green run moves to the left, and the red run below it joins the center in cascade.
  'sort-06.json': [
    [0, 0],
    [1, 0],
    [-1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
  ],
  // A cleared cell takes a new stack. The yellow tiles are a decoy.
  'sort-07.json': [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 0],
    [2, -1],
    [0, 0],
    [1, 0],
  ],
  // The blue clear frees two green runs, and they meet on the cell (-1, 0).
  'sort-08.json': [
    [0, 0],
    [1, 0],
    [-1, 0],
    [1, 0],
    [0, 0],
    [-2, 0],
    [-1, -1],
    [-1, 0],
  ],
  // A tie of two blue runs goes to the cell whose key comes first.
  'sort-09.json': [
    [0, 0],
    [1, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
  ],
  // Red and blue clear in the north, and green and yellow clear in the south.
  'sort-10.json': [
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
    [2, -2],
    [0, 2],
    [-2, 0],
    [-2, 2],
  ],
  // Square: the three red runs make one stack of 10 red tiles.
  'sort-square-01.json': [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  // Square: a tie of two red runs goes to the cell (0, 0), and the blue run below joins the blue stack.
  'sort-square-02.json': [
    [0, 0],
    [2, 0],
    [1, 0],
    [2, 1],
  ],
  // Square: red clears first, then blue and green. The yellow tiles are a decoy.
  'sort-square-03.json': [
    [0, 0],
    [2, 0],
    [0, 1],
    [1, 0],
    [2, 2],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  // Triangle: the three red runs make one stack of 10 red tiles.
  'sort-triangle-01.json': [
    [2, 0],
    [1, 0],
    [3, 0],
  ],
  // Triangle: a tie of two red runs goes to the cell (2, 0), and the blue run below joins the blue stack.
  'sort-triangle-02.json': [
    [2, 0],
    [4, 0],
    [3, 0],
    [4, 1],
  ],
  // Triangle: red clears first, then blue and green. The yellow tiles are a decoy.
  'sort-triangle-03.json': [
    [2, 0],
    [4, 0],
    [2, 1],
    [3, 0],
    [7, 2],
    [3, 1],
    [4, 1],
    [3, 2],
  ],
};

// The fields of each object of the format, in the order of its table.
const LEVEL_FIELDS = ['gameId', 'levelId', 'order', 'version', 'topology', 'section'];
const SECTION_FIELDS = ['radius', 'goals', 'source', 'stars'];
const LAST_SEED = 4294967295;

const isWhole = (value: unknown): value is number => Number.isSafeInteger(value);
const isColor = (value: unknown) => typeof value === 'string' && value.trim() !== '';
const hasFields = (value: unknown, fields: string[]) =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).sort().join() === [...fields].sort().join();
const isList = (value: unknown, item: (each: unknown) => boolean) =>
  Array.isArray(value) && value.length > 0 && value.every(item);
const isSource = (value: unknown) => {
  const { seed, colors, stacks } = value as Record<string, unknown>;
  const seeded =
    hasFields(value, ['seed', 'colors']) &&
    isWhole(seed) &&
    seed >= 0 &&
    seed <= LAST_SEED &&
    isList(colors, isColor);
  const fixed = hasFields(value, ['stacks']) && isList(stacks, (each) => isList(each, isColor));
  return seeded || fixed;
};

describe('bundled Sort levels', () => {
  // Each figure numbers its levels from 1, and the id of a level names its figure (#354).
  // So a new level of one figure moves no id of another figure: an id is the key of a saved
  // result (classes.md decision 57). The test groups the files by `topology`, so an id
  // whose prefix names another figure fails it.
  it('should_number_the_levels_of_each_figure_from_one_in_the_order_of_their_ids_when_the_folder_is_read', () => {
    const files = bundledFiles();

    expect(topologiesOf(files)).toEqual(FIGURES.map(({ topology }) => topology));
    for (const { topology, prefix, least } of FIGURES) {
      const group = files.filter(([, file]) => file.topology === topology);
      expect([topology, group.length >= least]).toEqual([topology, true]);
      expect(group.map(([name, file]) => [name, file.levelId, file.order])).toEqual(
        group.map((_, index) => {
          const id = `${prefix}${String(index + 1).padStart(2, '0')}`;
          return [`${id}.json`, id, index + 1];
        }),
      );
    }
  });

  // The format document: each object holds exactly the fields of its table, each list holds
  // one item or more, a color is a text that is not blank, a seed is a whole number
  // from 0 to 4294967295, and every other number is a whole number.
  it('should_hold_exactly_the_fields_of_the_level_format_when_a_bundled_file_is_read', () => {
    for (const [name, file] of bundledFiles()) {
      const { section } = file;
      const problems = [
        hasFields(file, LEVEL_FIELDS) || 'level fields',
        file.gameId === 'hexa-sort' || 'gameId',
        (isWhole(file.version) && file.version >= 1) || 'version',
        FIGURES.some(({ topology }) => topology === file.topology) || 'topology',
        hasFields(section, SECTION_FIELDS) || 'section fields',
        (isWhole(section.radius) && section.radius >= 1) || 'radius',
        (isWhole(section.goals) && section.goals >= 1) || 'goals',
        isSource(section.source) || 'source',
        isList(
          section.stars,
          (threshold) =>
            hasFields(threshold, ['maxMoves']) &&
            isWhole((threshold as { maxMoves: unknown }).maxMoves) &&
            (threshold as { maxMoves: number }).maxMoves >= 0,
        ) || 'stars',
      ].filter((check) => check !== true);

      expect([name, problems]).toEqual([name, []]);
    }
  });

  // The format document names its complete Sort example as a fixture of the level tests.
  it('should_hold_the_complete_sort_example_of_the_format_when_the_first_level_is_read', () => {
    const [[, first]] = bundledFiles();

    expect(first).toEqual(sortLevelFile());
  });

  // On hex, the board of radius r holds 3r(r + 1) + 1 cells, on the square (r + 1)² cells
  // and on the triangle 2(r + 1)² cells. A fixed level offers its first stack first,
  // and a seeded level offers one tile of one of its colors (decision 47).
  it('should_start_each_level_with_its_board_its_goal_and_its_first_stack_when_the_sort_factory_builds_it', () => {
    for (const [name, file] of bundledFiles()) {
      const { radius, source } = file.section;

      const { cells, goal, offered } = firstPhoto(file);

      const [tile] = offered;
      const firstStack =
        'stacks' in source
          ? offered.join() === source.stacks[0]?.join()
          : offered.length === 1 && tile !== undefined && source.colors.includes(tile);
      expect([name, cells]).toEqual([name, figureOf(file).cells(radius)]);
      expect([name, goal]).toEqual([name, true]);
      expect([name, firstStack]).toEqual([name, true]);
    }
  });

  // A4: the level holds the data of its source, and the factory builds a new source
  // for each game. The bundled levels hold both kinds of source.
  it('should_draw_the_same_stacks_when_two_games_start_from_one_built_level', () => {
    const files = bundledFiles();

    for (const [name, file] of files) {
      const [first = [], second] = offeredInTwoGames(file);

      expect([name, first.length, first.every((stack) => stack.length > 0)]).toEqual([
        name,
        4,
        true,
      ]);
      expect([name, second]).toEqual([name, first]);
    }
    expect(new Set(files.map(([, file]) => 'stacks' in file.section.source)).size).toBe(2);
  });

  // The first level holds the thresholds of the format example: 40, 30 and 20 moves.
  // The stars are cumulative, and the time of a Sort play changes no star.
  it('should_give_the_stars_of_its_file_when_a_bundled_level_counts_the_stars_of_a_play', () => {
    const [[, first]] = bundledFiles();
    const level = withGeometryOf(first.topology, { use: (geometry) => built(first, geometry) });
    const starsOf = (moves: number) => level.starsFor(Moves.of(moves));

    expect(starsOf(35)).toEqual(Stars.of(1));
    expect(starsOf(20)).toEqual(Stars.of(3));
    expect(starsOf(41)).toEqual(Stars.of(0));
  });

  // A fixed level can be won. Its plan meets the threshold of its last star,
  // so the third star can be won. Each plan plays on the geometry of its figure (#354).
  it('should_win_each_fixed_level_with_every_star_when_the_player_places_its_stacks_by_its_plan', () => {
    const fixed = bundledFiles().filter(([, file]) => 'stacks' in file.section.source);

    expect(topologiesOf(fixed)).toEqual(FIGURES.map(({ topology }) => topology));
    expect(fixed.map(([name]) => name)).toEqual(Object.keys(PLANS));
    for (const [name, file] of fixed) {
      const plan = PLANS[name] ?? [];

      const { outcomes, stars } = planPlay(file, plan);

      const playing = plan.slice(1).map(() => Outcome.playing);
      expect([name, outcomes]).toEqual([name, [...playing, Outcome.victory]]);
      expect([name, stars]).toEqual([name, Stars.of(file.section.stars.length)]);
    }
  });
});
