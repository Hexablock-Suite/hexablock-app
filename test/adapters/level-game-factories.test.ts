/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import {
  fitLevelVariant,
  LevelGameFactories,
  sortLevelVariant,
} from '../../src/adapters/level-game-factories';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fit03 from '../../src/adapters/levels/fit/fit-03.json';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import type { GameEngine } from '../../src/domain/engine/game-engine';
import { GameId } from '../../src/domain/engine/game-id';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { LevelDefinition } from '../../src/domain/engine/level-definition';
import { LevelId } from '../../src/domain/engine/level-id';
import { SquareGeometry } from '../../src/domain/engine/square-geometry';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { ManualClock } from '../support/engine/manual-clock';
import { CountingMatchIds } from '../support/engine/match-id';
import { startVariant } from '../support/engine/variant-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';
import { viewData } from '../support/variants/view-data';

// Issue #172 (S3-13 in #151, option D): `LevelGameFactories` implements the `GameFactories` port
// of layer 2. It finds a level in the `LevelRepository` port, builds it with the level builder
// of the variant and gives the `GameFactory` of that level. The tests run the real
// `BundledLevelRepository`, so each level comes from its bundled file.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');
const LINES = GameId.of('hexa-lines');
const geometry = new HexGeometry();
const clock = new ManualClock();

// The Fit factory of one level file, built with the level builder and no adapter.
const fitFactoryOf = (file: typeof fit01) =>
  new FitFactory(
    geometry,
    LevelDefinition.of(file).buildWith(new FitLevelBuilder(geometry)),
    clock,
  );

// The Fit factories of the bundled levels. A start with no level id gets the first level.
const fitFactories = () =>
  new LevelGameFactories(
    FIT,
    fitFactoryOf(fit01),
    new CountingMatchIds(),
    new BundledLevelRepository(),
    fitLevelVariant(geometry, clock),
  );

// The board and the view data of a started game.
function startOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(game: GameEngine<TCell, TCoord, TMove, TState>) {
  const photo = game.snapshot();
  return {
    cells: photo.boardCopy().occupiedCells(),
    freeSpaces: photo.boardCopy().freeSpaces(),
    payload: viewData(photo.view()),
  };
}

describe('LevelGameFactories', () => {
  // A game with no levels starts with no level id (Hexa Lines and Hexa Merge).
  it('should_give_the_factory_of_the_registered_variant_when_the_start_names_no_level', async () => {
    const factories = new LevelGameFactories(
      LINES,
      linesFactory(),
      new CountingMatchIds(),
      new BundledLevelRepository(),
    );

    const game = (await factories.factoryFor()).createGame();

    expect(startOf(game)).toEqual(startOf(startVariant(linesFactory()).engine));
  });

  // `fit-03` has ten cells, and the first level has six.
  it('should_build_the_level_with_the_level_builder_of_the_variant_when_the_repository_has_the_level_id', async () => {
    const factory = await fitFactories().factoryFor(LevelId.of('fit-03'));

    const started = startOf(factory.createGame());

    expect(started).toEqual(startOf(startVariant(fitFactoryOf(fit03)).engine));
    expect(started.freeSpaces).toHaveLength(10);
  });

  it('should_reject_with_the_level_id_as_cause_when_the_game_has_no_level_with_the_id', async () => {
    const missing = LevelId.of('fit-09');

    await expect(fitFactories().factoryFor(missing)).rejects.toThrow(
      new RangeError('The game has no level with this id.', { cause: missing }),
    );
  });

  // `fit-01` is a bundled level, but of another game. A game with no level variant has no level.
  it('should_reject_each_level_id_when_the_game_has_no_level_variant', async () => {
    const factories = new LevelGameFactories(
      LINES,
      linesFactory(),
      new CountingMatchIds(),
      new BundledLevelRepository(),
    );
    const levelId = LevelId.of('fit-01');

    await expect(factories.factoryFor(levelId)).rejects.toThrow(
      new RangeError('The game has no level with this id.', { cause: levelId }),
    );
  });

  // S3-08 in #151: a level runs only on the figure that its topology names.
  // Every bundled level is hex, so the Sort factories of the square refuse `sort-01`.
  it('should_reject_the_level_when_its_topology_is_not_the_figure_of_the_variant', async () => {
    const factories = new LevelGameFactories(
      SORT,
      sortFactory(),
      new CountingMatchIds(),
      new BundledLevelRepository(),
      sortLevelVariant(new SquareGeometry()),
    );

    await expect(factories.factoryFor(LevelId.of('sort-01'))).rejects.toThrow(
      'A Sort level builder cannot build the board of another topology.',
    );
  });
});
