/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ElapsedTime } from '../../../../src/domain/engine/elapsed-time';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import type { HexCoord } from '../../../../src/domain/engine/hex-topology';
import { LevelDefinition } from '../../../../src/domain/engine/level-definition';
import { Moves } from '../../../../src/domain/engine/moves';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Stars } from '../../../../src/domain/engine/stars';
import { Turns } from '../../../../src/domain/engine/turns';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import type { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { FitLevelBuilder } from '../../../../src/domain/variants/hexa-fit/fit-level-builder';
import { PlaceFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { ManualClock } from '../../../support/engine/manual-clock';
import { startVariant } from '../../../support/engine/variant-game';
import { repoRoot } from '../../../support/run-tool';
import { fitLevelFile } from '../../../support/variants/hexa-fit/fit-level-file';

// The bundled Fit levels (issue #166, APP-FR-05, A5). Each file follows the shared level format
// of hexablock-api `docs/level-format.md`. The test reads every file of the folder,
// so a new level file joins the test with no change here.

const folder = path.join(repoRoot, 'src/adapters/levels/fit');
const geometry = new HexGeometry();

// The fields of one witness entry, as the file writes them.
type WitnessEntry = { piece: string; rotation: number; at: number[] };
type LevelFile = {
  gameId: string;
  levelId: string;
  order: number;
  version: number;
  topology: string;
  section: { witness: WitnessEntry[] } & Record<string, unknown>;
};

// Every bundled Fit level file, by its file name, in the order of the names.
function bundledFiles(): [string, LevelFile][] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as LevelFile]);
}

function built(file: LevelFile): FitLevel<HexCoord> {
  return LevelDefinition.of(file).buildWith(new FitLevelBuilder(geometry));
}

// The place move of each witness entry: the piece turns, and then it moves by `at`.
function witnessMoves(file: LevelFile): PlaceFitPiece<HexCoord>[] {
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

describe('bundled Fit levels', () => {
  it('should_hold_three_levels_or_more_in_the_order_of_their_ids_when_the_folder_is_read', () => {
    const files = bundledFiles();

    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files.map(([name, file]) => [name, file.levelId, file.order])).toEqual(
      files.map((_, index) => {
        const id = `fit-${String(index + 1).padStart(2, '0')}`;
        return [`${id}.json`, id, index + 1];
      }),
    );
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
        file.topology === 'hex' || 'topology',
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
  it('should_build_each_level_and_win_it_with_its_witness_when_the_fit_rules_play_it', () => {
    for (const [name, file] of bundledFiles()) {
      const { engine } = startVariant(new FitFactory(geometry, built(file), new ManualClock()));
      const moves = witnessMoves(file);

      const outcomes = moves.map((move) => engine.play(move));

      const playing = moves.slice(1).map(() => Outcome.playing);
      expect([name, outcomes]).toEqual([name, [...playing, Outcome.victory]]);
      expect([name, engine.snapshot().moves]).toEqual([name, Moves.of(moves.length)]);
    }
  });

  // The level holds the thresholds of the file: 12 moves and 120 s, 8 moves and 60 s,
  // 4 moves and 30 s. The stars are cumulative.
  it('should_give_the_stars_of_its_file_when_a_bundled_level_counts_the_stars_of_a_play', () => {
    const [[, first]] = bundledFiles();
    const level = built(first);
    const starsOf = (moves: number, elapsedMs: number) =>
      level.starsFor(Moves.of(moves), ElapsedTime.ofMs(elapsedMs));

    expect(starsOf(10, 100000)).toEqual(Stars.of(1));
    expect(starsOf(4, 30000)).toEqual(Stars.of(3));
    expect(starsOf(13, 1000)).toEqual(Stars.of(0));
  });
});
