/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LevelGameFactories } from '../../src/adapters/level-game-factories';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fit02 from '../../src/adapters/levels/fit/fit-02.json';
import fit03 from '../../src/adapters/levels/fit/fit-03.json';
import sort01 from '../../src/adapters/levels/sort/sort-01.json';
import sort02 from '../../src/adapters/levels/sort/sort-02.json';
import fitSquare01 from '../../src/adapters/levels/fit/fit-square-01.json';
import type { LevelRepository } from '../../src/application/level-repository';
import type { MoveResult } from '../../src/application/move-result';
import type { ProgressRepository } from '../../src/application/progress-repository';
import { StartGame } from '../../src/application/start-game';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import type { LevelVariant } from '../../src/domain/engine/level-variant';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { Stars } from '../../src/domain/progress/stars';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { fitLevelVariant } from '../../src/domain/variants/hexa-fit/fit-level-variant';
import { SortFactory } from '../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevelBuilder } from '../../src/domain/variants/hexa-sort/sort-level-builder';
import { sortLevelVariant } from '../../src/domain/variants/hexa-sort/sort-level-variant';
import { errorOf, MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { ManualClock } from '../support/engine/manual-clock';
import { CountingMatchIds } from '../support/engine/match-id';
import { seededRandom } from '../support/engine/step-random';
import { startVariant } from '../support/engine/variant-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { viewData } from '../support/variants/view-data';

// Issue #172 (S3-13 in #151, option D): `StartGameRequest` names the level, and `StartGame`
// asks its `GameFactories` port for the factory of that level. The composition root builds
// one `StartGame` for each game, so one `StartGame` starts every level of its game.
// The tests run the real `LevelGameFactories` of layer 3 over the real `BundledLevelRepository`.
// Each expected start comes from a factory that the test builds from the level file alone.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');
const LINES = GameId.of('hexa-lines');
const MERGE = GameId.of('hexa-merge');
const geometry = new HexGeometry();
const clock = new ManualClock();

// The Fit factory and the Sort factory of one level file, built with the level builder.
const fitFactoryOf = (file: typeof fit01) =>
  new FitFactory(
    geometry,
    LevelDefinition.of(file).buildWith(new FitLevelBuilder(geometry)),
    clock,
  );
const sortFactoryOf = (file: typeof sort01 | typeof sort02) =>
  new SortFactory(
    geometry,
    LevelDefinition.of(file).buildWith(new SortLevelBuilder(geometry)),
    seededRandom(1),
  );

// A progress repository that keeps a won result of each level of `won` for the game `gameId`.
// With no level, it keeps no progress, as a new device does.
function progressWith(gameId: GameId, ...won: string[]): ProgressRepository {
  const progress = GameProgress.start(gameId);
  for (const levelId of won) {
    progress.recordLevel(
      ProgressRecord.of({
        gameId,
        score: Score.of(0),
        levelId: LevelId.of(levelId),
        stars: Stars.of(1),
      }),
    );
  }
  return {
    load: async () => (won.length === 0 ? undefined : progress),
    save: async () => undefined,
  };
}

// One `StartGame` over one game repository, as the composition root builds it for one game
// on the hexagon. `factory` is the registered factory, for a start with no level id.
// `progress` is the saved progress that tells an open level from a locked one (#397).
function startGameOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(
  gameId: GameId,
  factory: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
  levels?: LevelVariant<TCell, TCoord, TMove, TState>,
  progress: ProgressRepository | undefined = progressWith(gameId),
  repository: LevelRepository = new BundledLevelRepository(),
) {
  const games = new MemoryGameRepository<TCell, TCoord, TMove, TState>();
  const factories = new LevelGameFactories(
    gameId,
    factory,
    new CountingMatchIds(),
    repository,
    levels,
  );
  return {
    games,
    startGame: new StartGame(factories, games, repository, progress, gameId, TopologyId.hex),
  };
}

// The registered factory of each game with levels is a level that the tests do not start.
// The first two Fit levels are won, so `fit-02` and `fit-03` are open.
const fitGame = (progress = progressWith(FIT, 'fit-01', 'fit-02')) =>
  startGameOf(FIT, fitFactoryOf(fit01), fitLevelVariant(geometry, clock), progress);
const sortGame = () =>
  startGameOf(SORT, sortFactoryOf(sort02), sortLevelVariant(geometry, seededRandom(1)));

// The cells, the free spaces and the view data of a new game of `factory`.
function startOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const photo = startVariant(factory).engine.snapshot();
  return {
    cells: photo.boardCopy().occupiedCells(),
    freeSpaces: photo.boardCopy().freeSpaces(),
    payload: viewData(photo.view()),
  };
}

// The same three parts of the answer of `StartGame`.
function partsOf<TCell, TCoord, TView>(result: MoveResult<TCell, TCoord, TView>) {
  return { cells: result.cells, freeSpaces: result.freeSpaces, payload: viewData(result.payload) };
}

describe('StartGame with a level id', () => {
  // Done when of issue #172. `fit-02` has seven cells, and the radius 2 of `sort-01` gives 19.
  it('should_start_fit_level_2_and_sort_level_1_when_the_request_of_each_start_game_names_the_level', async () => {
    const fit = fitGame();
    const sort = sortGame();

    const fitStarted = valueOf(await fit.startGame.execute({ levelId: LevelId.of('fit-02') }));
    const sortStarted = valueOf(await sort.startGame.execute({ levelId: LevelId.of('sort-01') }));

    expect(partsOf(fitStarted)).toEqual(startOf(fitFactoryOf(fit02)));
    expect(partsOf(sortStarted)).toEqual(startOf(sortFactoryOf(sort01)));
    expect([fitStarted.freeSpaces.length, sortStarted.freeSpaces.length]).toEqual([7, 19]);
  });

  // The root builds `StartGame` once per game, not once per level.
  it('should_start_each_level_and_keep_the_last_one_when_one_start_game_gets_two_level_ids', async () => {
    const { games, startGame } = fitGame();

    const third = valueOf(await startGame.execute({ levelId: LevelId.of('fit-03') }));
    const second = valueOf(await startGame.execute({ levelId: LevelId.of('fit-02') }));

    expect([partsOf(third), partsOf(second)]).toEqual([
      startOf(fitFactoryOf(fit03)),
      startOf(fitFactoryOf(fit02)),
    ]);
    expect(games.running().snapshot().boardCopy().freeSpaces()).toEqual(second.freeSpaces);
  });

  // Done when of issue #172: a game with no levels starts with no level id.
  it('should_start_lines_and_merge_when_the_request_names_no_level', async () => {
    const lines = startGameOf(LINES, linesFactory());
    const merge = startGameOf(MERGE, mergeFactory());

    const started = [
      partsOf(valueOf(await lines.startGame.execute({}))),
      partsOf(valueOf(await merge.startGame.execute({}))),
    ];

    expect(started).toEqual([startOf(linesFactory()), startOf(mergeFactory())]);
  });

  // A start with no level id keeps the behavior of the time before #172:
  // the game starts with the factory that the composition root registered.
  it('should_start_the_registered_factory_when_a_game_with_levels_gets_no_level_id', async () => {
    const started = valueOf(await fitGame().startGame.execute({}));

    expect(partsOf(started)).toEqual(startOf(fitFactoryOf(fit01)));
  });

  // The port rejects a level that the game does not have, and `StartGame` answers `start-failed`.
  // A failed start keeps the running game (classes.md decision 40).
  it('should_return_a_start_failed_failure_and_keep_the_running_game_when_the_game_has_no_level_with_the_id', async () => {
    const { games, startGame } = fitGame();
    valueOf(await startGame.execute({ levelId: LevelId.of('fit-02') }));
    const running = games.running();
    const lines = startGameOf(LINES, linesFactory());

    const errors = [
      errorOf(await startGame.execute({ levelId: LevelId.of('fit-99') })),
      errorOf(await lines.startGame.execute({ levelId: LevelId.of('fit-01') })),
    ];

    expect(errors.map((error) => [error.code, error.message])).toEqual([
      ['start-failed', 'The game has no level with this id.'],
      ['start-failed', 'The game has no level with this id.'],
    ]);
    expect(games.current() === running).toBe(true);
    expect(lines.games.current()).toBeUndefined();
  });
});

// Issue #397: a link can name any level, so `StartGame` checks that the level is open.
// It lists the levels of its figure in the order of their files, as `ListLevels` does,
// and asks `LevelStatus.ofEach()` for the status of the level. A locked level gives
// a `level-locked` failure, and the repository keeps its old game.
describe('StartGame with a locked level', () => {
  const lockedCodes = async (
    startGame: { execute: StartGame<unknown, unknown, unknown, never>['execute'] },
    ids: string[],
  ) => {
    const codes: string[] = [];
    for (const id of ids) {
      const result = await startGame.execute({ levelId: LevelId.of(id) });
      codes.push(result.ok ? 'started' : result.error.code);
    }
    return codes;
  };

  // `fit-01` is won, so `fit-01` (completed) and `fit-02` (open) start, and `fit-03` is locked.
  it('should_return_a_level_locked_failure_and_keep_the_running_game_when_the_request_names_a_locked_level', async () => {
    const { games, startGame } = fitGame(progressWith(FIT, 'fit-01'));
    const started = await lockedCodes(startGame, ['fit-01', 'fit-02']);
    const running = games.running();

    const error = errorOf(await startGame.execute({ levelId: LevelId.of('fit-03') }));

    expect(started).toEqual(['started', 'started']);
    expect([error.code, error.message, error.retryable]).toEqual([
      'level-locked',
      'The level is locked.',
      false,
    ]);
    expect(games.current() === running).toBe(true);
  });

  // A game with no saved progress, or a root with no progress repository, has no won level:
  // only the first level is open (`LevelStatus.ofEach()` with no progress).
  it('should_start_only_the_first_level_when_the_game_has_no_saved_progress', async () => {
    const empty = fitGame(progressWith(FIT));
    const noRepository = startGameOf(
      FIT,
      fitFactoryOf(fit01),
      fitLevelVariant(geometry, clock),
      undefined,
    );

    const codes = [
      await lockedCodes(empty.startGame, ['fit-01', 'fit-02', 'fit-15']),
      await lockedCodes(noRepository.startGame, ['fit-01', 'fit-02']),
    ];

    expect(codes).toEqual([
      ['started', 'level-locked', 'level-locked'],
      ['started', 'level-locked'],
    ]);
    expect(noRepository.games.current()).toBeDefined();
  });

  // The repository gives the levels in no fixed order and with the levels of every figure.
  // The check keeps the levels of its figure and orders them by their files, so the square level
  // does not lock `fit-01`, and `fit-02` follows the won `fit-01`.
  it('should_order_the_levels_of_its_figure_by_their_files_when_the_repository_gives_another_order', async () => {
    const shuffled = [fit03, fitSquare01, fit02, fit01].map((file) => LevelDefinition.of(file));
    const repository: LevelRepository = {
      list: async () => [...shuffled],
      levelOf: async (_gameId, levelId) =>
        shuffled.find((level) => level.levelId().equals(levelId)),
      unavailable: async () => [],
    };
    const variant = fitLevelVariant(geometry, clock);
    const fresh = startGameOf(FIT, fitFactoryOf(fit01), variant, progressWith(FIT), repository);
    const won = startGameOf(
      FIT,
      fitFactoryOf(fit01),
      variant,
      progressWith(FIT, 'fit-01'),
      repository,
    );

    const codes = [
      await lockedCodes(fresh.startGame, ['fit-01', 'fit-02']),
      await lockedCodes(won.startGame, ['fit-02', 'fit-03']),
    ];

    expect(codes).toEqual([
      ['started', 'level-locked'],
      ['started', 'level-locked'],
    ]);
  });

  // A port that throws during the check gives `start-failed`, as a factory that throws does.
  it('should_return_a_start_failed_failure_when_the_progress_repository_throws_during_the_check', async () => {
    const broken: ProgressRepository = {
      load: async () => {
        throw new Error('The progress cannot be read.');
      },
      save: async () => undefined,
    };
    const { games, startGame } = fitGame(broken);

    const error = errorOf(await startGame.execute({ levelId: LevelId.of('fit-01') }));

    expect([error.code, error.message]).toEqual(['start-failed', 'The progress cannot be read.']);
    expect(games.current()).toBeUndefined();
  });

  // A start with no level id reads no level and no progress: Lines, Merge and the first level
  // of a game with levels start as before.
  it('should_read_no_progress_when_the_request_names_no_level', async () => {
    const load = jest.fn(async () => undefined);
    const { startGame } = fitGame({ load, save: async () => undefined });

    const started = valueOf(await startGame.execute({}));

    expect(partsOf(started)).toEqual(startOf(fitFactoryOf(fit01)));
    expect(load).not.toHaveBeenCalled();
  });
});
