/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fit02 from '../../src/adapters/levels/fit/fit-02.json';
import fit03 from '../../src/adapters/levels/fit/fit-03.json';
import sortSquare01 from '../../src/adapters/levels/sort/sort-square-01.json';
import sortSquare02 from '../../src/adapters/levels/sort/sort-square-02.json';
import sortSquare03 from '../../src/adapters/levels/sort/sort-square-03.json';
import type { AchievementSummary } from '../../src/application/list-achievements';
import type { MoveResult } from '../../src/application/move-result';
import type { Result } from '../../src/application/result';
import type { GeometryFactory } from '../../src/domain/engine/geometry-factory';
import { Outcome } from '../../src/domain/engine/outcome';
import { Turns } from '../../src/domain/engine/turns';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { Stars } from '../../src/domain/progress/stars';
import { GameId } from '../../src/domain/shared/game-id';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';
import { PlaceStack } from '../../src/domain/variants/hexa-sort/place-stack';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { withGeometryOf } from '../support/engine/geometry-of';
import { ManualClock } from '../support/engine/manual-clock';
import { repoRoot } from '../support/run-tool';

// Issue #180: the composition root builds `SaveProgress` and connects the end of a game to
// `ResultPresenter`. A won level is saved in the local progress, so `ListLevels` opens the next
// level and `ListAchievements` counts the won levels (`fit-3`, `sort-3` and `fit-all`).
// Each test plays through the `StartGame` and `ApplyMove` of the root and gives the last
// response to the `ResultPresenter` of a session of the root, as the game screen does.
// A new root over the same store is a restart of the app.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

type FitFile = typeof fit01;
type SortFile = typeof sortSquare01;

// The cells of the plans of the square Sort levels, from the tests of the bundled Sort levels.
// Each plan clears the goal of its level.
const SORT_PLANS: readonly (readonly [SortFile, readonly (readonly [number, number])[]])[] = [
  [
    sortSquare01,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
  ],
  [
    sortSquare02,
    [
      [0, 0],
      [2, 0],
      [1, 0],
      [2, 1],
    ],
  ],
  [
    sortSquare03,
    [
      [0, 0],
      [2, 0],
      [0, 1],
      [1, 0],
      [2, 2],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
  ],
];

// Every bundled Fit level file, in the order of the names: each figure in the order of its levels.
function bundledFitFiles(): FitFile[] {
  const folder = path.join(repoRoot, 'src/adapters/levels/fit');
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as FitFile);
}

// The board figure of the `topology` text of a level file.
function figureOf(topology: string): TopologyId {
  const figures: Readonly<Record<string, TopologyId>> = {
    hex: TopologyId.hex,
    square: TopologyId.square,
    triangle: TopologyId.triangle,
  };
  const figure = figures[topology];
  if (figure === undefined) throw new RangeError(`No figure has the topology ${topology}.`);
  return figure;
}

// The ids of the completed achievements of a success, or the code of a failure.
function completedOf(result: Result<AchievementSummary[]>): string[] | string {
  return result.ok
    ? result.value.filter(({ completed }) => completed).map(({ id }) => id)
    : result.error.code;
}

function rootOver(store?: InMemoryKeyValueStore, logger = new RecordingLogger()): CompositionRoot {
  return store === undefined
    ? new CompositionRoot({ clock: new ManualClock(), logger })
    : new CompositionRoot({ clock: new ManualClock(), logger, store });
}

// Starts the level `levelId` of `gameId` on `figure` with the use cases of `root`, plays
// `moves` and gives the last response to the result presenter of a new session of the root.
// It gives the last response and the session.
async function playAndFinish(
  root: CompositionRoot,
  gameId: GameId,
  figure: TopologyId,
  levelId: string,
  moves: readonly unknown[],
) {
  const { startGame, applyMove } = root.gameUseCases(gameId, figure);
  valueOf(await startGame.execute({ levelId: LevelId.of(levelId) }));
  let last: MoveResult<unknown, unknown> | undefined;
  for (const move of moves) last = valueOf(await applyMove.execute({ move }));
  if (last === undefined) throw new RangeError('The play holds no move.');
  const session = root.gameSession(gameId, figure);
  await session.result.onFinish(last);
  return { last, session };
}

// Wins the bundled Fit level of `file` through `root` with the moves of its witness.
async function winFit(root: CompositionRoot, file: FitFile) {
  return withGeometryOf(file.topology, {
    use: (geometry) =>
      playAndFinish(root, FIT, figureOf(file.topology), file.levelId, witness(file, geometry)),
  });
}

// The place move of each witness entry of a bundled Fit level.
function witness<TCoord>(
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

// Wins the square Sort level of `file` through `root` by its plan.
async function winSort(
  root: CompositionRoot,
  file: SortFile,
  plan: readonly (readonly [number, number])[],
) {
  return withGeometryOf(file.topology, {
    use: (geometry) =>
      playAndFinish(
        root,
        SORT,
        figureOf(file.topology),
        file.levelId,
        plan.map((at) => PlaceStack.on(geometry.createCoord([...at]))),
      ),
  });
}

describe('CompositionRoot results', () => {
  // Done when of #180: a test wins a Fit level, and the saved progress has its result.
  // The witness of `fit-01` takes 3 moves and no time, so the play wins every star.
  // `ListLevels` then opens `fit-02`, and the result screen offers it.
  it('should_save_the_result_and_open_the_next_level_when_a_fit_level_is_won_through_the_root', async () => {
    const store = new InMemoryKeyValueStore();
    const logger = new RecordingLogger();
    const root = rootOver(store, logger);

    const { last, session } = await winFit(root, fit01);
    const progress = valueOf(await rootOver(store).loadProgress().execute({ gameId: FIT }));
    const levels = valueOf(
      await rootOver(store).listLevels().execute({ gameId: FIT, figure: TopologyId.hex }),
    );

    expect(last.outcome.equals(Outcome.victory)).toBe(true);
    expect(progress?.starsOf(LevelId.of('fit-01'))?.equals(Stars.of(3))).toBe(true);
    expect(levels.levels.slice(0, 3).map(({ status }) => status)).toEqual([
      LevelStatus.completed,
      LevelStatus.open,
      LevelStatus.locked,
    ]);
    expect(session.result.viewModel()?.next).toEqual({
      label: 'Siguiente nivel',
      levelId: 'fit-02',
    });
    expect(logger.entries.filter((entry) => entry.useCase === 'SaveProgress')).toEqual([
      expect.objectContaining({ useCase: 'SaveProgress', outcome: 'success' }),
    ]);
  });

  // Done when of #180 (changed on 2026-11-26): «win every Hexa Fit level» asks for every level of
  // every figure (`EveryLevelWon`), so the test wins the 21 bundled Fit levels. The two
  // achievements stay completed after a restart.
  it('should_complete_fit_3_and_fit_all_when_every_bundled_fit_level_is_won_through_the_root', async () => {
    const store = new InMemoryKeyValueStore();
    const root = rootOver(store);
    const files = bundledFitFiles();

    const outcomes: Outcome[] = [];
    for (const file of files) outcomes.push((await winFit(root, file)).last.outcome);
    const played = await root.listAchievements().execute({});
    const restarted = await rootOver(store).listAchievements().execute({});

    expect(files).toHaveLength(21);
    expect(outcomes.every((outcome) => outcome.equals(Outcome.victory))).toBe(true);
    expect(completedOf(played)).toEqual(['fit-3', 'fit-all']);
    expect(completedOf(restarted)).toEqual(['fit-3', 'fit-all']);
  });

  // Three won Fit levels give «win 3 levels of Hexa Fit», and not «win every Hexa Fit level».
  it('should_complete_fit_3_and_not_fit_all_when_three_fit_levels_are_won_through_the_root', async () => {
    const store = new InMemoryKeyValueStore();
    const root = rootOver(store);

    for (const file of [fit01, fit02, fit03]) await winFit(root, file);

    expect(completedOf(await rootOver(store).listAchievements().execute({}))).toEqual(['fit-3']);
  });

  // The same test for Hexa Sort: the three square levels have fixed stacks and a winning plan.
  it('should_complete_sort_3_when_three_sort_levels_are_won_through_the_root', async () => {
    const store = new InMemoryKeyValueStore();
    const root = rootOver(store);

    const outcomes: Outcome[] = [];
    for (const [file, plan] of SORT_PLANS)
      outcomes.push((await winSort(root, file, plan)).last.outcome);

    expect(outcomes.every((outcome) => outcome.equals(Outcome.victory))).toBe(true);
    expect(completedOf(await rootOver(store).listAchievements().execute({}))).toEqual(['sort-3']);
  });

  // A root with no local store gives no `SaveProgress`. The result screen shows the text
  // of a failed save, and nothing throws.
  it('should_show_the_text_of_a_failed_save_when_a_root_with_no_store_ends_a_level', async () => {
    const { session } = await winFit(rootOver(), fit01);

    expect(session.result.viewModel()?.error).toBe('No se pudo guardar el resultado.');
  });
});
