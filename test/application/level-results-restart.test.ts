/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import type { KeyValueStore } from '../../src/adapters/key-value-store';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { LevelSummary } from '../../src/application/level-summary';
import { ListLevels } from '../../src/application/list-levels';
import { Result } from '../../src/application/result';
import { SaveProgress } from '../../src/application/save-progress';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import type { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { Moves } from '../../src/domain/shared/moves';
import {
  GameResult,
  ProgressRecord,
  type IProgressModel,
} from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { Stars } from '../../src/domain/progress/stars';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { SortFactory } from '../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevelBuilder } from '../../src/domain/variants/hexa-sort/sort-level-builder';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { ManualClock } from '../support/engine/manual-clock';
import { seededRandom } from '../support/engine/step-random';
import { delivered } from '../support/engine/value-receiver';

// The integration tests of APP-NFR-15 for the two games with levels (issue #183, APP-FR-09).
// A level result that `SaveProgress` saves survives a restart of the app, and `ListLevels`
// gives it back with its stars and its status (S3-04 and S3-12 in #151).
// The tests run the real `BundledLevelRepository` and the real `LocalProgressRepository`
// over the in-memory `KeyValueStore`. A restart builds every repository, progress model
// and use case again over the same store. The store keeps only texts,
// so only the saved text crosses a restart.

const geometry = new HexGeometry();

// One play of a level: its moves, its time for a timed level, and the stars that the
// thresholds of the level file give to it.
interface Play {
  readonly moves: number;
  readonly ms?: number;
  readonly stars: number;
}

// One game with levels. `best` is a play of the first level. Each play of `worse` is worse
// than `best` by the order of DS-4: fewer stars, or equal stars and more moves,
// or equal moves and more time. The last play of `worse` wins fewer stars.
interface LevelGame {
  readonly gameId: GameId;
  // The first two bundled levels of the game.
  readonly levelIds: readonly [string, string];
  // The progress model of the level of `definition`. The factory of the level gives it,
  // so the model counts the stars with the thresholds of the level file.
  readonly modelOf: (definition: LevelDefinition) => IProgressModel;
  readonly best: Play;
  readonly worse: readonly Play[];
}

// `fit-01` gives one star for 12 moves in 120 s, two stars for 8 moves in 60 s,
// and three stars for 4 moves in 30 s. Its witness places its three pieces in three moves.
const FIT: LevelGame = {
  gameId: GameId.of('hexa-fit'),
  levelIds: ['fit-01', 'fit-02'],
  modelOf: (definition) =>
    new FitFactory(
      geometry,
      definition.buildWith(new FitLevelBuilder(geometry)),
      new ManualClock(),
    ).createProgressModel(),
  best: { moves: 3, ms: 25_000, stars: 3 },
  worse: [
    { moves: 3, ms: 28_000, stars: 3 },
    { moves: 4, ms: 25_000, stars: 3 },
    { moves: 9, ms: 90_000, stars: 1 },
  ],
};

// `sort-01` gives one star for 40 moves, two stars for 30 moves and three stars for 20 moves.
// A Sort level has no timer, so a play has no time.
const SORT: LevelGame = {
  gameId: GameId.of('hexa-sort'),
  levelIds: ['sort-01', 'sort-02'],
  modelOf: (definition) =>
    new SortFactory(
      geometry,
      definition.buildWith(new SortLevelBuilder(geometry)),
      seededRandom(1),
    ).createProgressModel(),
  best: { moves: 36, stars: 1 },
  worse: [
    { moves: 39, stars: 1 },
    { moves: 41, stars: 0 },
  ],
};

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

// The result of `play` on the first level of `game`.
function resultOf(game: LevelGame, play: Play): GameResult {
  return GameResult.of({
    gameId: game.gameId,
    score: Score.of(0),
    moves: Moves.of(play.moves),
    levelId: LevelId.of(game.levelIds[0]),
    elapsedMs: play.ms === undefined ? undefined : ElapsedTime.ofMs(play.ms),
  });
}

// The record that the progress of `game` keeps for `play` on its first level.
function recordOf(game: LevelGame, play: Play): ProgressRecord {
  return ProgressRecord.of({
    gameId: game.gameId,
    score: Score.of(0),
    levelId: LevelId.of(game.levelIds[0]),
    stars: Stars.of(play.stars),
    moves: Moves.of(play.moves),
    elapsedMs: play.ms === undefined ? undefined : ElapsedTime.ofMs(play.ms),
  });
}

// The objects of one run of the app for `game` over the device storage `store`.
// Each call builds new repositories, so a second call is a restart.
function runOf(game: LevelGame, store: KeyValueStore) {
  const levels = new BundledLevelRepository();
  const progress = new LocalProgressRepository(store);
  return {
    progress,
    // Saves `play` of the first level with `SaveProgress` and the progress model of that level.
    async save(play: Play): Promise<Result<void>> {
      const first = LevelId.of(game.levelIds[0]);
      const level = (await levels.list(game.gameId)).find((each) => each.levelId().equals(first));
      if (level === undefined) throw new RangeError('The first level is not bundled.');
      const save = new SaveProgress(progress, game.modelOf(level), game.gameId);
      return save.execute(resultOf(game, play));
    },
    // The levels of the game on the hex figure, as rows, or the code of a failure.
    async list(): Promise<Row[] | string> {
      const list = new ListLevels(levels, progress);
      const result = await list.execute({ gameId: game.gameId, figure: TopologyId.hex });
      return result.ok ? result.value.map(rowOf) : result.error.code;
    },
  };
}

// The rows after a won first level: it is completed with `stars`, the second level is open,
// and every later level stays locked (S3-12). The later ids come from the bundled levels
// of the hex figure. The levels of the square and of the triangle (#354) are not on its list.
async function rowsAfterWin(game: LevelGame, stars: number): Promise<Row[]> {
  const [first, second] = game.levelIds;
  const levels = await new BundledLevelRepository().list(game.gameId);
  const later = levels
    .filter((level) => level.isPlayedOn(TopologyId.hex))
    .slice(2)
    .map((level) => delivered(level.levelId()));
  return [
    { level: first, status: 'completed', stars },
    { level: second, status: 'open' },
    ...later.map((level) => ({ level, status: 'locked' })),
  ];
}

describe.each([
  ['Hexa Fit', FIT],
  ['Hexa Sort', SORT],
])('The level results of %s after a restart', (_name, game) => {
  // Done when of issue #183: the check of #42 (APP-NFR-15) for this game.
  // The saved record also keeps the moves and the time of the play.
  it('should_list_the_saved_stars_and_status_when_the_app_restarts_after_a_level_is_won', async () => {
    const store = new InMemoryKeyValueStore();

    const saved = await runOf(game, store).save(game.best);
    const restarted = runOf(game, store);
    const rows = await restarted.list();
    const loaded = await restarted.progress.load(game.gameId);

    expect(saved).toEqual(Result.success(undefined));
    expect(rows).toEqual(await rowsAfterWin(game, game.best.stars));
    expect(loaded?.keeps(recordOf(game, game.best))).toBe(true);
  });

  // Done when of issue #183: a worse result does not replace the best one (DS-4, DS-12).
  // The last worse play wins fewer stars, so a replaced best result changes the listed stars.
  it('should_keep_the_best_result_when_a_worse_result_of_the_level_is_saved_after_a_restart', async () => {
    const store = new InMemoryKeyValueStore();
    await runOf(game, store).save(game.best);

    const second = runOf(game, store);
    const saved: Result<void>[] = [];
    for (const play of game.worse) saved.push(await second.save(play));
    const third = runOf(game, store);
    const rows = await third.list();
    const loaded = await third.progress.load(game.gameId);

    expect(saved).toEqual(game.worse.map(() => Result.success(undefined)));
    expect(rows).toEqual(await rowsAfterWin(game, game.best.stars));
    // The list shows only the stars. The saved records show the steps of the moves and the time.
    expect([game.best, ...game.worse].map((play) => loaded?.keeps(recordOf(game, play)))).toEqual([
      true,
      ...game.worse.map(() => false),
    ]);
  });
});
