/** @jest-environment node */
import { FitStateMapper } from '../../src/adapters/fit-state-mapper';
import { MergeStateMapper } from '../../src/adapters/merge-state-mapper';
import { SortStateMapper } from '../../src/adapters/sort-state-mapper';
import { LinesStateMapper } from '../../src/adapters/lines-state-mapper';
import { GameId } from '../../src/domain/engine/game-id';
import { TopologyId } from '../../src/domain/engine/geometry-factory';
import { LevelId } from '../../src/domain/engine/level-id';
import { FitCellRenderer } from '../../src/infrastructure/board/fit-cell-renderer';
import { MergeCellRenderer } from '../../src/infrastructure/board/merge-cell-renderer';
import { SortCellRenderer } from '../../src/infrastructure/board/sort-cell-renderer';
import { LinesCellRenderer } from '../../src/infrastructure/board/lines-cell-renderer';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { FitControls } from '../../src/infrastructure/ui/fit-controls';
import { MergeControls } from '../../src/infrastructure/ui/merge-controls';
import { LinesControls } from '../../src/infrastructure/ui/lines-controls';
import { SortControls } from '../../src/infrastructure/ui/sort-controls';
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

  // Issue #178: the root wires `RedoMove` over the repository of each game, inside the aspect.
  // The redo of a Fit move that was undone gives back the answer of that move.
  it('should_redo_the_undone_fit_move_and_log_each_call_when_the_root_wires_redo_move', async () => {
    const logger = new RecordingLogger();
    const root = testRoot(logger);
    const { startGame, applyMove, undoMove, redoMove } = root.gameUseCases(GameId.of('hexa-fit'));
    valueOf(await startGame.execute({}));
    const played = valueOf(
      await applyMove.execute({ move: firstMoveIn(root, GameId.of('hexa-fit')) }),
    );
    valueOf(await undoMove.execute({}));

    const redone = valueOf(await redoMove.execute({}));
    const second = errorOf(await redoMove.execute({}));

    expect(redone).toEqual(played);
    expect(second.code).toBe('nothing-to-redo');
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
      ['ApplyMove', 'success'],
      ['UndoMove', 'success'],
      ['RedoMove', 'success'],
      ['RedoMove', 'failure'],
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

  // Fit (#175), Sort (#176) and Merge (#177) each have their own screen parts.
  // Lines keeps the default parts until #174.
  it('should_give_fit_sort_and_merge_their_mappers_renderers_and_controls_when_the_root_builds_the_registry', () => {
    const registry = testRoot().registry();

    const parts = registry.gameIds().map((id) => {
      const { mapper, renderer, controls } = registry.gameOf(id).screen;
      return [variantIdOf(id), mapper.constructor, renderer.constructor, controls.constructor];
    });

    expect(parts).toEqual([
      ['hexa-lines', LinesStateMapper, LinesCellRenderer, LinesControls],
      ['hexa-fit', FitStateMapper, FitCellRenderer, FitControls],
      ['hexa-sort', SortStateMapper, SortCellRenderer, SortControls],
      ['hexa-merge', MergeStateMapper, MergeCellRenderer, MergeControls],
    ]);
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

    // Issue #297: the stones of the home screen and of the map take the shape of the figure.
    // The root gives the outline of the origin cell of each figure that it offers, scaled
    // so that the longer side of its box is the size that the screen asks for.
    it('should_give_the_shape_of_the_origin_cell_when_a_screen_asks_for_an_offered_figure', () => {
      const root = testRoot();

      const shapes = root.figures().map((figure) => root.figureShape(figure, 60));

      expect(shapes.map(({ corners }) => corners.length)).toEqual([6, 4, 3]);
      for (const { width, height } of shapes) expect(Math.max(width, height)).toBeCloseTo(60);
      // The triangle of the origin points up: one corner at the top.
      expect(shapes[2]?.corners[0]?.y).toBeCloseTo(0);
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

    // Issue #298: each entry declares the world colors of its game, so a game has one color
    // on every figure, and the four games have four colors.
    it('should_give_each_game_one_color_on_every_figure_when_each_entry_declares_its_colors', () => {
      const root = testRoot();
      const hexagon = root.registry();

      for (const figure of FIGURES) {
        const registry = root.registry(figure);
        for (const id of registry.gameIds()) {
          expect(registry.gameOf(id).tone).toEqual(hexagon.gameOf(id).tone);
        }
      }
      const tones = hexagon.gameIds().map((id) => hexagon.gameOf(id).tone.tone);
      expect(new Set(tones).size).toBe(FOUR_VARIANTS.length);
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

  // Issue #172 (S3-13 in #151, option D): the root builds one `StartGame` for each game,
  // and its `GameFactories` port gives the factory of a bundled level by its id.
  describe('levels', () => {
    // `fit-02` has seven cells. The Fit level of a start with no level id has three.
    it('should_start_the_bundled_level_when_the_start_game_of_the_root_gets_its_level_id', async () => {
      const { startGame } = testRoot().gameUseCases(GameId.of('hexa-fit'));

      const started = valueOf(await startGame.execute({ levelId: LevelId.of('fit-02') }));

      expect(started.freeSpaces).toHaveLength(7);
    });

    // Hexa Lines has no levels. Every bundled Sort level is hex, so the square refuses it (S3-08).
    it('should_answer_start_failed_when_the_game_on_the_figure_has_no_level_with_the_id', async () => {
      const root = testRoot();

      const errors = [
        errorOf(
          await root
            .gameUseCases(GameId.of('hexa-lines'))
            .startGame.execute({ levelId: LevelId.of('fit-01') }),
        ),
        errorOf(
          await root
            .gameUseCases(GameId.of('hexa-sort'), TopologyId.square)
            .startGame.execute({ levelId: LevelId.of('sort-01') }),
        ),
      ];

      expect(errors.map((error) => [error.code, error.message])).toEqual([
        ['start-failed', 'The game has no level with this id.'],
        ['start-failed', 'A Sort level builder cannot build the board of another topology.'],
      ]);
    });
  });

  it('should_write_each_call_to_the_console_when_the_root_takes_no_driver', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await new CompositionRoot().gameUseCases(GameId.of('hexa-lines')).startGame.execute({});

    expect(info).toHaveBeenCalledWith('StartGame: success');
    info.mockRestore();
  });
});
