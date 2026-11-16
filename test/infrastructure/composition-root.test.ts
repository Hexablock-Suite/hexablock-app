/** @jest-environment node */
import { GameId } from '../../src/domain/engine/game-id';
import { TopologyId } from '../../src/domain/engine/geometry-factory';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { errorOf, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { BOARD_ID } from '../support/engine/entity-ids';
import { ManualClock } from '../support/engine/manual-clock';
import { firstMoveOf } from '../support/engine/variant-game';
import { variantIdOf } from '../support/variants/variant-id';

// Issue #162: the composition root wires the layers in one place. It builds the drivers and
// the adapters, the game use cases of each registered game and the aspects around them.
// The tests build it with a manual clock and a recording logger, and render nothing.

const FOUR_VARIANTS = ['hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge'];

function testRoot(logger = new RecordingLogger()): CompositionRoot {
  return new CompositionRoot({ clock: new ManualClock(), logger });
}

// The first valid move of a new game of the registered game `gameId` on the board figure
// `figure`, by default the hexagon.
function firstMoveIn(root: CompositionRoot, gameId: GameId, figure = TopologyId.hex): unknown {
  return root
    .registry(figure)
    .gameOf(gameId)
    .withFactory({ use: (_gameId, factory) => firstMoveOf(factory) });
}

describe('CompositionRoot', () => {
  it('should_register_the_four_variants_when_the_root_is_built', () => {
    expect(testRoot().registry().gameIds().map(variantIdOf)).toEqual(FOUR_VARIANTS);
  });

  // Issue #234: the registry pairs each id with its factory in one place, and the root gives
  // that id to `GameFactory`. A factory that does not build the game of its id fails here.
  it('should_pair_each_registered_id_with_the_factory_of_that_game_when_the_root_is_built', () => {
    const registry = testRoot().registry();

    const pairs = registry.gameIds().map((id) =>
      registry.gameOf(id).withFactory({
        use: (gameId, factory) => gameId.equals(id) && factory.isFor(gameId),
      }),
    );

    expect(pairs).toEqual([true, true, true, true]);
  });

  // The first move of a new game of the registered factory is valid in the game that
  // `StartGame` opens: both start from the same factory with the same seed.
  it('should_start_each_game_and_accept_one_move_when_the_use_cases_come_from_the_root', async () => {
    const root = testRoot();
    const played: string[] = [];

    for (const gameId of root.registry().gameIds()) {
      const { startGame, applyMove } = root.gameUseCases(gameId);
      valueOf(await startGame.execute({}));
      const move = firstMoveIn(root, gameId);
      valueOf(await applyMove.execute({ move }));
      played.push(variantIdOf(gameId));
    }

    expect(played).toEqual(FOUR_VARIANTS);
  });

  it('should_log_each_call_when_the_root_wraps_the_use_cases_in_the_logging_aspect', async () => {
    const logger = new RecordingLogger();
    const { startGame, undoMove } = testRoot(logger).gameUseCases(GameId.of('hexa-lines'));

    await startGame.execute({});
    await undoMove.execute({});

    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
      ['UndoMove', 'failure'],
    ]);
  });

  it('should_give_the_same_use_cases_when_the_root_is_asked_twice_for_one_game', () => {
    const root = testRoot();

    expect(
      root.gameUseCases(GameId.of('hexa-fit')) === root.gameUseCases(GameId.of('hexa-fit')),
    ).toBe(true);
  });

  it('should_answer_no_running_game_when_only_another_game_has_started', async () => {
    const root = testRoot();
    await root.gameUseCases(GameId.of('hexa-merge')).startGame.execute({});

    const move = firstMoveIn(root, GameId.of('hexa-lines'));
    const result = await root.gameUseCases(GameId.of('hexa-lines')).applyMove.execute({ move });

    expect(errorOf(result).code).toBe('no-running-game');
  });

  it('should_throw_a_range_error_when_the_game_is_not_registered', () => {
    expect(() => testRoot().gameUseCases(GameId.of('hexa-fill'))).toThrow(
      new RangeError('The registry holds no game with this id.'),
    );
  });

  // Issue #171: the player chooses the board figure on the home screen (APP-FR-16).
  // The root builds one registry for each figure, and the hexagon is the default figure.
  describe('board figures', () => {
    const FIGURES = [TopologyId.hex, TopologyId.square, TopologyId.triangle];

    it('should_offer_the_hexagon_the_square_and_the_triangle_when_the_root_is_built', () => {
      const figures = testRoot().figures();

      expect(figures).toHaveLength(3);
      expect(figures.every((figure, i) => figure.equals(FIGURES[i]))).toBe(true);
    });

    it('should_give_the_registry_of_the_hexagon_when_the_caller_names_no_figure', () => {
      const root = testRoot();

      expect(root.registry() === root.registry(TopologyId.hex)).toBe(true);
    });

    // S3-08 in #151 («Propuesta, pendiente del equipo»): Fit offers only the levels whose
    // `topology` names the chosen figure. The first content has one Fit level, on the hexagon.
    it('should_offer_fit_only_on_the_hexagon_when_only_the_hexagon_has_a_fit_level', () => {
      const root = testRoot();

      expect(FIGURES.map((figure) => root.registry(figure).gameIds().map(variantIdOf))).toEqual([
        FOUR_VARIANTS,
        ['hexa-lines', 'hexa-sort', 'hexa-merge'],
        ['hexa-lines', 'hexa-sort', 'hexa-merge'],
      ]);
    });

    // A board region of size 5 holds 61 hexagons, 25 squares or 50 triangles,
    // and a region of size 3 holds 19 hexagons, 9 squares or 18 triangles.
    it('should_build_each_board_on_the_geometry_of_the_figure_when_the_figure_is_chosen', () => {
      const root = testRoot();

      const spaces = FIGURES.map((figure) => {
        const registry = root.registry(figure);
        return registry.gameIds().map((id) =>
          registry.gameOf(id).withFactory({
            use: (_gameId, factory) => factory.createBoard(BOARD_ID).coordinates().length,
          }),
        );
      });

      expect(spaces).toEqual([
        [61, 3, 19, 19],
        [25, 9, 9],
        [50, 18, 18],
      ]);
    });

    it('should_start_each_game_and_accept_one_move_when_the_game_runs_on_each_figure', async () => {
      const root = testRoot();
      const played: string[][] = [];

      for (const figure of FIGURES) {
        const ids: string[] = [];
        for (const gameId of root.registry(figure).gameIds()) {
          const { startGame, applyMove } = root.gameUseCases(gameId, figure);
          valueOf(await startGame.execute({}));
          valueOf(await applyMove.execute({ move: firstMoveIn(root, gameId, figure) }));
          ids.push(variantIdOf(gameId));
        }
        played.push(ids);
      }

      expect(played).toEqual([
        FOUR_VARIANTS,
        ['hexa-lines', 'hexa-sort', 'hexa-merge'],
        ['hexa-lines', 'hexa-sort', 'hexa-merge'],
      ]);
    });

    it('should_answer_no_running_game_when_the_game_started_only_on_another_figure', async () => {
      const root = testRoot();
      const lines = GameId.of('hexa-lines');
      await root.gameUseCases(lines, TopologyId.hex).startGame.execute({});

      const move = firstMoveIn(root, lines, TopologyId.square);
      const result = await root.gameUseCases(lines, TopologyId.square).applyMove.execute({ move });

      expect(
        root.gameUseCases(lines, TopologyId.hex) === root.gameUseCases(lines, TopologyId.square),
      ).toBe(false);
      expect(errorOf(result).code).toBe('no-running-game');
    });

    it('should_throw_a_range_error_when_the_game_is_not_registered_on_the_figure', () => {
      expect(() => testRoot().gameUseCases(GameId.of('hexa-fit'), TopologyId.square)).toThrow(
        new RangeError('The registry holds no game with this id.'),
      );
    });

    // `TopologyId` has a closed set of three instances, and the root offers all three.
    // Only a cast reaches the check.
    it('should_throw_a_range_error_when_the_root_offers_no_figure_with_the_id', () => {
      expect(() => testRoot().registry({} as TopologyId)).toThrow(
        new RangeError('The root offers no board figure with this id.'),
      );
    });
  });

  it('should_write_each_call_to_the_console_when_the_root_takes_no_driver', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await new CompositionRoot().gameUseCases(GameId.of('hexa-lines')).startGame.execute({});

    expect(info).toHaveBeenCalledWith('StartGame: success');
    info.mockRestore();
  });
});
