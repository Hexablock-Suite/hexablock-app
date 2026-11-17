/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import { hex, type HexCoord } from '../../../../src/domain/engine/hex-topology';
import { LevelDefinition } from '../../../../src/domain/engine/level-definition';
import { Moves } from '../../../../src/domain/engine/moves';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Stars } from '../../../../src/domain/engine/stars';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { PlaceStack } from '../../../../src/domain/variants/hexa-sort/place-stack';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import type { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import { SortLevelBuilder } from '../../../../src/domain/variants/hexa-sort/sort-level-builder';
import { startVariant } from '../../../support/engine/variant-game';
import { repoRoot } from '../../../support/run-tool';
import { names } from '../../../support/variants/hexa-sort/sort-game';
import { sortLevelFile } from '../../../support/variants/hexa-sort/sort-level-file';

// The bundled Sort levels (issue #167, APP-FR-05, A4). Each file follows the shared level format
// of hexablock-api `docs/level-format.md`. The test reads every file of the folder,
// so a new level file joins the test with no change here.

const folder = path.join(repoRoot, 'src/adapters/levels/sort');
const geometry = new HexGeometry();

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

function built(file: LevelFile): SortLevel {
  return LevelDefinition.of(file).buildWith(new SortLevelBuilder(geometry));
}

// The offered stack of a new game of `factory`, at the start and after each of three placements.
// No two of the three cells are neighbors, so no run moves and no stack clears.
function offeredInGame(factory: SortFactory<HexCoord>): string[][] {
  const { engine } = startVariant(factory);
  const offered = [names(engine.snapshot().offeredStack()?.occupant())];
  for (const at of [hex(0, 0), hex(2, 0), hex(-2, 0)]) {
    engine.play(PlaceStack.on(at));
    offered.push(names(engine.snapshot().offeredStack()?.occupant()));
  }
  return offered;
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
  it('should_hold_ten_levels_or_more_in_the_order_of_their_ids_when_the_folder_is_read', () => {
    const files = bundledFiles();

    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.map(([name, file]) => [name, file.levelId, file.order])).toEqual(
      files.map((_, index) => {
        const id = `sort-${String(index + 1).padStart(2, '0')}`;
        return [`${id}.json`, id, index + 1];
      }),
    );
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
        file.topology === 'hex' || 'topology',
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

  // On hex, the board of radius r holds 3r(r + 1) + 1 cells. A fixed level offers its first
  // stack first, and a seeded level offers one tile of one of its colors (decision 47).
  it('should_start_each_level_with_its_board_its_goal_and_its_first_stack_when_the_sort_factory_builds_it', () => {
    for (const [name, file] of bundledFiles()) {
      const { radius, goals, source } = file.section;
      const { engine } = startVariant(new SortFactory(geometry, built(file)));

      const photo = engine.snapshot();

      const offered = names(photo.offeredStack()?.occupant());
      const [tile] = offered;
      const firstStack =
        'stacks' in source
          ? offered.join() === source.stacks[0]?.join()
          : offered.length === 1 && tile !== undefined && source.colors.includes(tile);
      expect([name, photo.boardCopy().coordinates().length]).toEqual([
        name,
        3 * radius * (radius + 1) + 1,
      ]);
      expect([name, photo.goal().equals(GoalCount.of(goals))]).toEqual([name, true]);
      expect([name, firstStack]).toEqual([name, true]);
    }
  });

  // A4: the level holds the data of its source, and the factory builds a new source
  // for each game. The bundled levels hold both kinds of source.
  it('should_draw_the_same_stacks_when_two_games_start_from_one_built_level', () => {
    const files = bundledFiles();

    for (const [name, file] of files) {
      const factory = new SortFactory(geometry, built(file));

      const first = offeredInGame(factory);
      const second = offeredInGame(factory);

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
    const level = built(first);
    const starsOf = (moves: number) => level.starsFor(Moves.of(moves), undefined);

    expect(starsOf(35)).toEqual(Stars.of(1));
    expect(starsOf(20)).toEqual(Stars.of(3));
    expect(starsOf(41)).toEqual(Stars.of(0));
  });

  // A fixed level can be won. Its plan meets the threshold of its last star,
  // so the third star can be won.
  it('should_win_each_fixed_level_with_every_star_when_the_player_places_its_stacks_by_its_plan', () => {
    const fixed = bundledFiles().filter(([, file]) => 'stacks' in file.section.source);

    expect(fixed.map(([name]) => name)).toEqual(Object.keys(PLANS));
    for (const [name, file] of fixed) {
      const plan = PLANS[name] ?? [];
      const level = built(file);
      const { engine } = startVariant(new SortFactory(geometry, level));

      const outcomes = plan.map(([q, r]) => engine.play(PlaceStack.on(hex(q, r))));

      const playing = plan.slice(1).map(() => Outcome.playing);
      expect([name, outcomes]).toEqual([name, [...playing, Outcome.victory]]);
      expect([name, level.starsFor(Moves.of(plan.length), undefined)]).toEqual([
        name,
        Stars.of(file.section.stars.length),
      ]);
    }
  });
});
