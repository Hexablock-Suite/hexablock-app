/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import {
  fitLevelVariant,
  LevelGameFactories,
  sortLevelVariant,
  type LevelVariant,
} from '../../src/adapters/level-game-factories';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fit02 from '../../src/adapters/levels/fit/fit-02.json';
import fit03 from '../../src/adapters/levels/fit/fit-03.json';
import sort01 from '../../src/adapters/levels/sort/sort-01.json';
import sort02 from '../../src/adapters/levels/sort/sort-02.json';
import type { MoveResult } from '../../src/application/move-result';
import { StartGame } from '../../src/application/start-game';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { GameId } from '../../src/domain/engine/game-id';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { LevelDefinition } from '../../src/domain/engine/level-definition';
import { LevelId } from '../../src/domain/engine/level-id';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { SortFactory } from '../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevelBuilder } from '../../src/domain/variants/hexa-sort/sort-level-builder';
import { errorOf, MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { ManualClock } from '../support/engine/manual-clock';
import { CountingMatchIds } from '../support/engine/match-id';
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
  new SortFactory(geometry, LevelDefinition.of(file).buildWith(new SortLevelBuilder(geometry)));

// One `StartGame` over one game repository, as the composition root builds it for one game.
// `factory` is the registered factory, for a start with no level id.
function startGameOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(
  gameId: GameId,
  factory: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
  levels?: LevelVariant<TCell, TCoord, TMove, TState>,
) {
  const games = new MemoryGameRepository<TCell, TCoord, TMove, TState>();
  const factories = new LevelGameFactories(
    gameId,
    factory,
    new CountingMatchIds(),
    new BundledLevelRepository(),
    levels,
  );
  return { games, startGame: new StartGame(factories, games) };
}

// The registered factory of each game with levels is a level that the tests do not start.
const fitGame = () => startGameOf(FIT, fitFactoryOf(fit01), fitLevelVariant(geometry, clock));
const sortGame = () => startGameOf(SORT, sortFactoryOf(sort02), sortLevelVariant(geometry));

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
