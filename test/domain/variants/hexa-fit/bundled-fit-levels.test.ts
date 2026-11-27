/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ElapsedTime } from '../../../../src/domain/shared/elapsed-time';
import type { GeometryFactory } from '../../../../src/domain/engine/geometry-factory';
import { LevelDefinition } from '../../../../src/domain/progress/level-definition';
import { Moves } from '../../../../src/domain/shared/moves';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Stars } from '../../../../src/domain/progress/stars';
import { Turns } from '../../../../src/domain/engine/turns';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import type { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { FitLevelBuilder } from '../../../../src/domain/variants/hexa-fit/fit-level-builder';
import { PlaceFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { withGeometryOf } from '../../../support/engine/geometry-of';
import { ManualClock } from '../../../support/engine/manual-clock';
import { startVariant } from '../../../support/engine/variant-game';
import { repoRoot } from '../../../support/run-tool';
import { fitLevelFile } from '../../../support/variants/hexa-fit/fit-level-file';

// The bundled Fit levels (issue #166, APP-FR-05, A5). Each file follows the shared level format
// of hexablock-api `docs/level-format.md`. The test reads every file of the folder,
// so a new level file joins the test with no change here.
// Since #354 the folder also holds levels on the square and on the triangle. Each test reads
// a file through the geometry of the figure that its `topology` names.

const folder = path.join(repoRoot, 'src/adapters/levels/fit');

// The figures of the bundled levels, with the prefix of the level ids of each figure
// and the least count of levels on it. APP-FR-05 asks for 15 Fit levels, and the hexagon
// holds them. The square and the triangle hold 3 levels each (decision of #354).
const FIGURES: readonly (readonly [string, string, number])[] = [
  ['hex', 'fit-', 15],
  ['square', 'fit-square-', 3],
  ['triangle', 'fit-triangle-', 3],
];

// The fields of one witness entry, as the file writes them.
type WitnessEntry = { piece: string; rotation: number; at: number[] };
type StarEntry = { maxMoves: number; maxElapsedMs: number };
type LevelFile = {
  gameId: string;
  levelId: string;
  order: number;
  version: number;
  topology: string;
  section: { witness: WitnessEntry[]; stars: StarEntry[] } & Record<string, unknown>;
};

// Every bundled Fit level file, by its file name, in the order of the names.
function bundledFiles(): [string, LevelFile][] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as LevelFile]);
}

function built<TCoord>(file: LevelFile, geometry: GeometryFactory<TCoord>): FitLevel<TCoord> {
  return LevelDefinition.of(file).buildWith(new FitLevelBuilder(geometry));
}

// The place move of each witness entry: the piece turns, and then it moves by `at`.
function witnessMoves<TCoord>(
  file: LevelFile,
  geometry: GeometryFactory<TCoord>,
): PlaceFitPiece<TCoord>[] {
  return file.section.witness.map(
    (entry) =>
      new PlaceFitPiece(
        PieceId.of(entry.piece),
        Turns.of(entry.rotation),
        geometry.createCoord(entry.at),
      ),
  );
}

// The fields of each object of the format, in the order of its table.
const LEVEL_FIELDS = ['gameId', 'levelId', 'order', 'version', 'topology', 'section'];
const SECTION_FIELDS = ['figure', 'pieces', 'witness', 'stars'];

const isWhole = (value: unknown) => Number.isSafeInteger(value);
const isCell = (value: unknown) =>
  Array.isArray(value) && value.length === 2 && value.every(isWhole);
const hasFields = (value: unknown, fields: string[]) =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).sort().join() === [...fields].sort().join();
const isList = (value: unknown, item: (each: unknown) => boolean) =>
  Array.isArray(value) && value.length > 0 && value.every(item);

// The outcomes of the witness of `file`, played by the real Fit rules on the geometry of its
// figure, and the stars of a play of the witness that ends at the time limit of the last star.
function witnessPlay(file: LevelFile): { outcomes: Outcome[]; moves: Moves; stars: Stars } {
  return withGeometryOf(file.topology, {
    use: (geometry) => {
      const level = built(file, geometry);
      const { engine } = startVariant(new FitFactory(geometry, level, new ManualClock()));
      const outcomes = witnessMoves(file, geometry).map((move) => engine.play(move));
      const moves = engine.snapshot().moveCount();
      const last = file.section.stars[file.section.stars.length - 1];
      const stars = level.starsFor(moves, ElapsedTime.ofMs(last?.maxElapsedMs ?? 0));
      return { outcomes, moves, stars };
    },
  });
}

// The topology of each bundled file, once each, in the order of the names.
const topologiesOf = (files: [string, LevelFile][]) => [
  ...new Set(files.map(([, file]) => file.topology)),
];

describe('bundled Fit levels', () => {
  // Each figure numbers its levels from 1, and the id of a level names its figure (#354).
  // So a new level of one figure moves no id of another figure: an id is the key of a saved
  // result (classes.md decision 57). The test groups the files by `topology`, so an id
  // whose prefix names another figure fails it.
  it('should_number_the_levels_of_each_figure_from_one_in_the_order_of_their_ids_when_the_folder_is_read', () => {
    const files = bundledFiles();

    expect(topologiesOf(files)).toEqual(FIGURES.map(([topology]) => topology));
    for (const [topology, prefix, least] of FIGURES) {
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
  // one item or more, a coordinate of `hex` is a list of two whole numbers,
  // and every number is a whole number.
  it('should_hold_exactly_the_fields_of_the_level_format_when_a_bundled_file_is_read', () => {
    for (const [name, file] of bundledFiles()) {
      const { section } = file;
      const problems = [
        hasFields(file, LEVEL_FIELDS) || 'level fields',
        file.gameId === 'hexa-fit' || 'gameId',
        (isWhole(file.version) && file.version >= 1) || 'version',
        FIGURES.some(([topology]) => topology === file.topology) || 'topology',
        hasFields(section, SECTION_FIELDS) || 'section fields',
        isList(section.figure, isCell) || 'figure',
        isList(
          section.pieces,
          (piece) =>
            hasFields(piece, ['id', 'cells']) &&
            typeof (piece as { id: unknown }).id === 'string' &&
            isList((piece as { cells: unknown }).cells, isCell),
        ) || 'pieces',
        isList(
          section.witness,
          (entry) =>
            hasFields(entry, ['piece', 'rotation', 'at']) &&
            isWhole((entry as WitnessEntry).rotation) &&
            isCell((entry as WitnessEntry).at),
        ) || 'witness',
        isList(
          section.stars,
          (threshold) =>
            hasFields(threshold, ['maxMoves', 'maxElapsedMs']) &&
            Object.values(threshold as object).every((n) => isWhole(n) && n >= 0),
        ) || 'stars',
      ].filter((check) => check !== true);

      expect([name, problems]).toEqual([name, []]);
    }
  });

  // The format document names its complete Fit example as a fixture of the level tests.
  it('should_hold_the_complete_fit_example_of_the_format_when_the_first_level_is_read', () => {
    const [[, first]] = bundledFiles();

    expect(first).toEqual(fitLevelFile());
  });

  // A5: the builder checks the witness, and the real Fit rules win the level with it.
  // Each level is played on the geometry of its figure, also on the square and the triangle.
  it('should_build_each_level_and_win_it_with_its_witness_when_the_fit_rules_play_it', () => {
    const files = bundledFiles();

    expect(topologiesOf(files)).toEqual(FIGURES.map(([topology]) => topology));
    for (const [name, file] of files) {
      const { outcomes, moves } = witnessPlay(file);

      const playing = file.section.witness.slice(1).map(() => Outcome.playing);
      expect([name, outcomes]).toEqual([name, [...playing, Outcome.victory]]);
      expect([name, moves]).toEqual([name, Moves.of(file.section.witness.length)]);
    }
  });

  // Issue #354: the thresholds of each level can be reached. The witness meets the move limit
  // of the last star, so a play of the witness within the time limit of that star wins
  // every star of the level.
  it('should_win_every_star_of_each_level_when_its_witness_is_played_within_the_time_of_the_last_star', () => {
    const files = bundledFiles();

    expect(topologiesOf(files)).toEqual(FIGURES.map(([topology]) => topology));
    for (const [name, file] of files) {
      const { stars } = witnessPlay(file);

      expect([name, stars]).toEqual([name, Stars.of(file.section.stars.length)]);
    }
  });

  // The level holds the thresholds of the file: 12 moves and 120 s, 8 moves and 60 s,
  // 4 moves and 30 s. The stars are cumulative.
  it('should_give_the_stars_of_its_file_when_a_bundled_level_counts_the_stars_of_a_play', () => {
    const [[, first]] = bundledFiles();
    const level = withGeometryOf(first.topology, { use: (geometry) => built(first, geometry) });
    const starsOf = (moves: number, elapsedMs: number) =>
      level.starsFor(Moves.of(moves), ElapsedTime.ofMs(elapsedMs));

    expect(starsOf(10, 100000)).toEqual(Stars.of(1));
    expect(starsOf(4, 30000)).toEqual(Stars.of(3));
    expect(starsOf(13, 1000)).toEqual(Stars.of(0));
  });
});
