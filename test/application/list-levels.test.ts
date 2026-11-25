/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { LevelRepository } from '../../src/application/level-repository';
import type { LevelSummary } from '../../src/application/level-summary';
import { ListLevels, type ListLevelsRequest } from '../../src/application/list-levels';
import type { ProgressRepository } from '../../src/application/progress-repository';
import { Result } from '../../src/application/result';
import { SaveProgress } from '../../src/application/save-progress';
import { ElapsedTime } from '../../src/domain/engine/elapsed-time';
import { GameId } from '../../src/domain/engine/game-id';
import { GameProgress } from '../../src/domain/engine/game-progress';
import { TopologyId } from '../../src/domain/engine/geometry-factory';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { LevelDefinition } from '../../src/domain/engine/level-definition';
import { LevelId } from '../../src/domain/engine/level-id';
import { LevelStatus } from '../../src/domain/engine/level-status';
import { Moves } from '../../src/domain/engine/moves';
import { GameResult, ProgressRecord } from '../../src/domain/engine/progress-model';
import { Score } from '../../src/domain/engine/score';
import { Stars } from '../../src/domain/engine/stars';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { ManualClock } from '../support/engine/manual-clock';
import { delivered } from '../support/engine/value-receiver';
import { fitLevelFile, squareFitLevelFile } from '../support/variants/hexa-fit/fit-level-file';

// `ListLevels` lists the levels of a game on the chosen figure with their status and stars
// (issue #168, APP-FR-02, S3-12 and S3-08 in #151). The tests run the real
// `BundledLevelRepository` and the real `LocalProgressRepository` over the in-memory
// `KeyValueStore`. A level is won when `SaveProgress` saves its result.

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');
const geometry = new HexGeometry();
const onHex: ListLevelsRequest = { gameId: FIT, figure: TopologyId.hex };

// One summary as plain data. A status gives its name through `equals()`.
type Row = { level: string; status: string; stars?: number };

const names: readonly (readonly [LevelStatus, string])[] = [
  [LevelStatus.completed, 'completed'],
  [LevelStatus.open, 'open'],
  [LevelStatus.locked, 'locked'],
];

function rowOf(summary: LevelSummary): Row {
  const status = names.find(([named]) => named.equals(summary.status))?.[1] ?? 'unknown';
  const row = { level: delivered(summary.levelId), status };
  return summary.stars === undefined ? row : { ...row, stars: delivered(summary.stars) };
}

// The rows of a success, or the code of a failure.
function rowsOf(result: Result<LevelSummary[]>): Row[] | string {
  return result.ok ? result.value.map(rowOf) : result.error.code;
}

// The result of one play of the bundled Fit level `fit-01`.
const fitPlay = (moves: number, ms: number) =>
  GameResult.of({
    gameId: FIT,
    score: Score.of(0),
    moves: Moves.of(moves),
    levelId: LevelId.of('fit-01'),
    elapsedMs: ElapsedTime.ofMs(ms),
  });

// The ids of the bundled Fit levels after the first two, in the order of the repository.
async function laterFitIds(): Promise<string[]> {
  const levels = await new BundledLevelRepository().list(FIT);
  return levels.slice(2).map((level) => delivered(level.levelId()));
}

// `ListLevels` over the bundled levels, and `SaveProgress` of the first Fit level,
// over one local progress. The progress model counts the stars with the thresholds of `fit-01`.
function fitUseCases(levels: LevelRepository = new BundledLevelRepository()) {
  const progress = new LocalProgressRepository(new InMemoryKeyValueStore());
  const level = LevelDefinition.of(fitLevelFile()).buildWith(new FitLevelBuilder(geometry));
  const model = new FitFactory(geometry, level, new ManualClock()).createProgressModel();
  return {
    progress,
    list: new ListLevels(levels, progress),
    save: new SaveProgress(progress, model, FIT),
  };
}

describe('ListLevels', () => {
  // Done when of issue #168: level N+1 opens when level N is won (S3-12).
  // Four moves in 30 s win the three stars of `fit-01`.
  it('should_open_level_2_and_lock_level_3_when_fit_level_1_is_won', async () => {
    const { list, save } = fitUseCases();
    const later = await laterFitIds();

    const saved = await save.execute(fitPlay(4, 30_000));
    const result = await list.execute(onHex);

    expect(saved).toEqual(Result.success(undefined));
    expect(rowsOf(result)).toEqual([
      { level: 'fit-01', status: 'completed', stars: 3 },
      { level: 'fit-02', status: 'open' },
      ...later.map((level) => ({ level, status: 'locked' })),
    ]);
    expect(later[0]).toBe('fit-03');
  });

  // Done when of issue #168: thirteen moves pass every move limit of `fit-01`, so the play
  // wins zero stars (D22). The level is still won, so the next level opens.
  it('should_open_the_next_level_when_a_level_is_won_with_zero_stars', async () => {
    const { list, save } = fitUseCases();
    const later = await laterFitIds();

    await save.execute(fitPlay(13, 1000));
    const result = await list.execute(onHex);

    expect(rowsOf(result)).toEqual([
      { level: 'fit-01', status: 'completed', stars: 0 },
      { level: 'fit-02', status: 'open' },
      ...later.map((level) => ({ level, status: 'locked' })),
    ]);
  });

  // Done when of issue #168: Fit lists only the levels of the chosen figure (S3-08).
  // The square level has order 2. It is the first level of the square figure, so it is open.
  it('should_list_only_the_level_of_the_chosen_figure_when_a_hex_level_and_a_square_level_exist', async () => {
    const { list } = fitUseCases(
      new BundledLevelRepository([fitLevelFile(), squareFitLevelFile()]),
    );

    const hex = await list.execute(onHex);
    const square = await list.execute({ gameId: FIT, figure: TopologyId.square });

    expect(rowsOf(hex)).toEqual([{ level: 'fit-01', status: 'open' }]);
    expect(rowsOf(square)).toEqual([{ level: 'fit-square-01', status: 'open' }]);
  });

  // The open point of S3-08: the list of a figure with no level is empty, and it is no failure.
  // A game with no levels, such as Hexa Lines, gives the same empty list.
  it('should_give_an_empty_list_when_no_level_of_the_game_is_played_on_the_chosen_figure', async () => {
    const { list } = fitUseCases();

    const results = [
      await list.execute({ gameId: FIT, figure: TopologyId.triangle }),
      await list.execute({ gameId: LINES, figure: TopologyId.hex }),
    ];

    expect(results).toEqual([Result.success([]), Result.success([])]);
  });

  it('should_open_only_the_first_level_when_the_game_has_no_saved_progress', async () => {
    const { list } = fitUseCases();
    const later = await laterFitIds();

    const result = await list.execute(onHex);

    expect(rowsOf(result)).toEqual([
      { level: 'fit-01', status: 'open' },
      { level: 'fit-02', status: 'locked' },
      ...later.map((level) => ({ level, status: 'locked' })),
    ]);
  });

  // The `order` of each file places the level, not the order of the repository.
  // Level 2 is won and level 1 is not: level 1 stays open, and level 3 opens after level 2.
  it('should_list_the_levels_in_their_order_when_the_repository_gives_them_in_another_order', async () => {
    const level = (id: string, order: number) => ({ ...fitLevelFile(), levelId: id, order });
    const { list, progress } = fitUseCases(
      new BundledLevelRepository([level('fit-03', 3), level('fit-01', 1), level('fit-02', 2)]),
    );
    const saved = GameProgress.start(FIT);
    saved.recordLevel(
      ProgressRecord.of({
        gameId: FIT,
        score: Score.of(0),
        levelId: LevelId.of('fit-02'),
        stars: Stars.of(1),
      }),
    );
    await progress.save(saved);

    const result = await list.execute(onHex);

    expect(rowsOf(result)).toEqual([
      { level: 'fit-01', status: 'open' },
      { level: 'fit-02', status: 'completed', stars: 1 },
      { level: 'fit-03', status: 'open' },
    ]);
  });

  // No exception leaves `execute()` (classes.md decision 28).
  it('should_fail_with_list_failed_when_a_port_throws', async () => {
    const error = new Error('The store is gone.');
    const brokenLevels: LevelRepository = {
      list: () => Promise.reject(error),
      levelOf: () => Promise.reject(error),
    };
    const brokenProgress: ProgressRepository = {
      load: () => Promise.reject(error),
      save: () => Promise.resolve(),
    };
    const { progress } = fitUseCases();

    const results = [
      await new ListLevels(brokenLevels, progress).execute(onHex),
      await new ListLevels(new BundledLevelRepository(), brokenProgress).execute(onHex),
    ];

    expect(
      results.map((result) =>
        result.ok ? 'success' : [result.error.code, result.error.message, result.error.cause],
      ),
    ).toEqual([
      ['list-failed', 'The store is gone.', error],
      ['list-failed', 'The store is gone.', error],
    ]);
  });
});
