/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fit02 from '../../src/adapters/levels/fit/fit-02.json';
import type { MoveResult } from '../../src/application/move-result';
import type { Result } from '../../src/application/result';
import { SaveProgress } from '../../src/application/save-progress';
import type { AchievementSummary } from '../../src/application/list-achievements';
import { GameId } from '../../src/domain/shared/game-id';
import type { GeometryFactory } from '../../src/domain/engine/geometry/geometry-factory';
import { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import { Moves } from '../../src/domain/shared/moves';
import { Outcome } from '../../src/domain/engine/events/outcome';
import { GameResult } from '../../src/domain/progress/progress-model';
import { Turns } from '../../src/domain/engine/geometry/turns';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { gameUseCases, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { withGeometryOf } from '../support/engine/geometry-of';
import { ManualClock } from '../support/engine/manual-clock';
import { repoRoot } from '../support/run-tool';

// Issue #188: the composition root lists the achievements of the player over the saved progress
// of the device. The tests give the root an in-memory `KeyValueStore` in place of the device.
// A new root over the same store is a restart of the app: the store keeps what the old root saved.

const FIT = GameId.of('hexa-fit');

// The achievements of issue #188, in the order of the screen.
const SEVEN = [
  'lines-combo',
  'merge-256',
  'merge-2048',
  'fit-3',
  'sort-3',
  'fit-all',
  'sort-goals',
];

type FitFile = typeof fit01;

// Every bundled Fit level file, in the order of the names.
function bundledFitFiles(): FitFile[] {
  const folder = path.join(repoRoot, 'src/adapters/levels/fit');
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as FitFile);
}

// The ids of the completed achievements of a success, or the code of a failure.
function completedOf(result: Result<AchievementSummary[]>): string[] | string {
  return result.ok
    ? result.value.filter(({ completed }) => completed).map(({ id }) => id)
    : result.error.code;
}

// The place move of each witness entry of a bundled Fit level: the piece turns,
// and then it moves by `at`.
function witnessMoves<TCoord>(
  file: FitFile,
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

// Plays the bundled Fit level of `file` to its end through `StartGame` and `ApplyMove`, with the
// moves of its witness. Then it saves the result through `SaveProgress` over the local progress
// of `store`, as the victory screen of #180 does. It gives the outcome of the last move.
// The level plays on the geometry of the figure that its `topology` names (#354).
async function playAndSave(file: FitFile, store: InMemoryKeyValueStore): Promise<Outcome> {
  return withGeometryOf(file.topology, { use: (geometry) => playAndSaveOn(geometry, file, store) });
}

async function playAndSaveOn<TCoord>(
  geometry: GeometryFactory<TCoord>,
  file: FitFile,
  store: InMemoryKeyValueStore,
): Promise<Outcome> {
  const level = LevelDefinition.of(file).buildWith(new FitLevelBuilder(geometry));
  const factory = new FitFactory(geometry, level, new ManualClock());
  const { startGame, applyMove } = gameUseCases(factory);
  valueOf(await startGame.execute({}));
  let last: MoveResult<unknown, TCoord> | undefined;
  for (const move of witnessMoves(file, geometry)) {
    last = valueOf(await applyMove.execute({ move }));
  }
  if (last === undefined) throw new RangeError('The witness holds no move.');
  const save = new SaveProgress(
    new LocalProgressRepository(store),
    factory.createProgressModel(),
    FIT,
  );
  valueOf(
    await save.execute(
      GameResult.of({
        gameId: FIT,
        score: last.score,
        moves: Moves.of(file.section.witness.length),
        levelId: LevelId.of(file.levelId),
        elapsedMs: last.elapsedMs,
      }),
    ),
  );
  return last.outcome;
}

function rootOver(store: InMemoryKeyValueStore, logger = new RecordingLogger()): CompositionRoot {
  return new CompositionRoot({ clock: new ManualClock(), logger, store });
}

describe('CompositionRoot achievements', () => {
  // The screen lists each achievement of the issue. With no saved progress none is completed.
  // The root wraps the use case in the logging aspect, as it wraps each game use case.
  it('should_list_the_seven_achievements_in_progress_when_no_progress_is_saved', async () => {
    const logger = new RecordingLogger();

    const result = await rootOver(new InMemoryKeyValueStore(), logger)
      .listAchievements()
      .execute({});

    expect(valueOf(result).map(({ id, completed }) => [id, completed])).toEqual(
      SEVEN.map((id) => [id, false]),
    );
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['ListAchievements', 'success'],
    ]);
  });

  // Done when of issue #188: a test earns one achievement through a played game, and the
  // achievement is still there after the app restarts. Every bundled Fit level won earns
  // «win 3 levels of Hexa Fit» and «win every Hexa Fit level». Since #354 every Fit level
  // includes the levels of the square and of the triangle.
  it('should_keep_the_fit_achievements_completed_after_a_restart_when_every_fit_level_is_won', async () => {
    const store = new InMemoryKeyValueStore();
    const before = await rootOver(store).listAchievements().execute({});

    const outcomes: Outcome[] = [];
    const files = bundledFitFiles();
    for (const file of files) outcomes.push(await playAndSave(file, store));
    const played = await rootOver(store).listAchievements().execute({});
    const restarted = await rootOver(store).listAchievements().execute({});

    expect(files.map((file) => file.levelId)).toContain('fit-15');
    expect(outcomes.every((outcome) => Outcome.victory.equals(outcome))).toBe(true);
    expect(completedOf(before)).toEqual([]);
    expect(completedOf(played)).toEqual(['fit-3', 'fit-all']);
    expect(completedOf(restarted)).toEqual(['fit-3', 'fit-all']);
  });

  // Two won levels are not three: the achievement stays in progress.
  it('should_keep_win_3_fit_levels_in_progress_when_two_fit_levels_are_won', async () => {
    const store = new InMemoryKeyValueStore();

    for (const file of [fit01, fit02]) await playAndSave(file, store);
    const result = await rootOver(store).listAchievements().execute({});

    expect(completedOf(result)).toEqual([]);
  });

  // Single scope (decision 18): the root builds the use case once.
  it('should_give_the_same_use_case_when_the_root_is_asked_twice', () => {
    const root = rootOver(new InMemoryKeyValueStore());

    expect(root.listAchievements()).toBe(root.listAchievements());
  });

  // A root with no local store reads no progress, so it has no achievements to list.
  it('should_throw_an_error_when_the_root_has_no_store_and_lists_achievements', () => {
    const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });

    expect(() => root.listAchievements()).toThrow(
      new Error('The root has no local store, so it lists no achievements.'),
    );
  });
});
