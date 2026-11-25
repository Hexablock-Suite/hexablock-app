/** @jest-environment node */
import { AchievementCounterListener } from '../../src/adapters/achievement-counter-listener';
import { FitStateMapper } from '../../src/adapters/fit-state-mapper';
import { GameEventBus } from '../../src/adapters/game-event-bus';
import { MergeStateMapper } from '../../src/adapters/merge-state-mapper';
import { SortStateMapper } from '../../src/adapters/sort-state-mapper';
import { LinesStateMapper } from '../../src/adapters/lines-state-mapper';
import { GameId } from '../../src/domain/engine/game-id';
import { TopologyId } from '../../src/domain/engine/geometry-factory';
import { LevelId } from '../../src/domain/engine/level-id';
import { Turns } from '../../src/domain/engine/turns';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';
import { StackCleared } from '../../src/domain/variants/hexa-sort/stack-cleared';
import { TileCount } from '../../src/domain/variants/hexa-sort/tile-count';
import { FitCellRenderer } from '../../src/infrastructure/board/fit-cell-renderer';
import { MergeCellRenderer } from '../../src/infrastructure/board/merge-cell-renderer';
import { SortCellRenderer } from '../../src/infrastructure/board/sort-cell-renderer';
import { LinesCellRenderer } from '../../src/infrastructure/board/lines-cell-renderer';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { FitControls } from '../../src/infrastructure/ui/fit-controls';
import { MergeControls } from '../../src/infrastructure/ui/merge-controls';
import { LinesControls } from '../../src/infrastructure/ui/lines-controls';
import { SortControls } from '../../src/infrastructure/ui/sort-controls';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { errorOf, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { BOARD_ID } from '../support/engine/entity-ids';
import { MATCH_ID } from '../support/engine/match-id';
import { withGeometryOf } from '../support/engine/geometry-of';
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
    // `topology` names the chosen figure. Since #354 each figure has a first Fit level,
    // so the map of each figure shows the four games.
    it('should_offer_fit_on_every_figure_when_each_figure_has_a_first_fit_level', () => {
      const root = testRoot();

      expect(FIGURES.map((figure) => root.registry(figure).gameIds().map(variantIdOf))).toEqual([
        FOUR_VARIANTS,
        FOUR_VARIANTS,
        FOUR_VARIANTS,
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
    // The first Fit level of each figure has three cells in a row.
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
        [25, 3, 9, 9],
        [50, 3, 18, 18],
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

      expect(played).toEqual([FOUR_VARIANTS, FOUR_VARIANTS, FOUR_VARIANTS]);
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
      expect(() => testRoot().gameUseCases(GameId.of('hexa-fill'), TopologyId.square)).toThrow(
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

  // Issue #362: the root builds one `GameEventBus`, subscribes its first listener to it, and gives
  // it to the `ApplyMove` of every game. The first Fit level of a figure ends with a victory
  // after two moves, so each game records one `GameOver`. The Fit games of the hexagon and of
  // the square have two `ApplyMove` over two repositories, and both publish to the same bus.
  // Issue #363: the listener saves the counters of the achievements through one
  // `LocalAchievementCounterRepository` over the local store of the drivers, so a goal of Sort
  // that the listener hears reaches that store.
  it('should_give_one_bus_with_the_counter_listener_to_every_apply_move_when_the_root_wires_the_games', async () => {
    const subscribe = jest.spyOn(GameEventBus.prototype, 'subscribe');
    const publish = jest.spyOn(GameEventBus.prototype, 'publish');
    try {
      const store = new InMemoryKeyValueStore();
      const root = new CompositionRoot({
        clock: new ManualClock(),
        logger: new RecordingLogger(),
        store,
      });

      for (const figure of [TopologyId.hex, TopologyId.square]) {
        const { startGame, applyMove } = root.gameUseCases(GameId.of('hexa-fit'), figure);
        valueOf(await startGame.execute({}));
        for (const move of withGeometryOf(figure === TopologyId.hex ? 'hex' : 'square', {
          use: (geometry) => [
            new PlaceFitPiece(PieceId.of('a'), Turns.of(0), geometry.createCoord([0, 0])),
            new PlaceFitPiece(PieceId.of('b'), Turns.of(0), geometry.createCoord([2, 0])),
          ],
        })) {
          valueOf(await applyMove.execute({ move }));
        }
      }

      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(subscribe.mock.calls[0][0]).toBeInstanceOf(AchievementCounterListener);
      const bus = subscribe.mock.contexts[0];
      expect(publish).toHaveBeenCalledTimes(2);
      expect(publish.mock.contexts).toEqual([bus, bus]);
      expect(publish.mock.contexts.every((context) => context === bus)).toBe(true);
      const listener = subscribe.mock.calls[0][0] as AchievementCounterListener;
      listener.onEvent(new StackCleared(GameId.of('hexa-sort'), MATCH_ID, 0, TileCount.of(6)));
      await listener.saved();
      await expect(store.get('achievement-counters:hexa-sort')).resolves.toBe(
        '{"version":1,"best":0,"total":1}',
      );
    } finally {
      subscribe.mockRestore();
      publish.mockRestore();
    }
  });

  // Issue #363: a root with no local store has no place to save the counters,
  // so it subscribes no counter listener. Its bus still takes the events of every move.
  it('should_subscribe_no_counter_listener_when_the_root_has_no_local_store', async () => {
    const subscribe = jest.spyOn(GameEventBus.prototype, 'subscribe');
    try {
      const root = testRoot();
      const { startGame, applyMove } = root.gameUseCases(GameId.of('hexa-lines'));
      valueOf(await startGame.execute({}));

      valueOf(await applyMove.execute({ move: firstMoveIn(root, GameId.of('hexa-lines')) }));

      expect(subscribe).not.toHaveBeenCalled();
    } finally {
      subscribe.mockRestore();
    }
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

    // Hexa Lines has no levels. `sort-01` is a hex level, so the square refuses it (S3-08).
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

    // Issue #354: the square and the triangle have their own Fit and Sort levels.
    // A start with no level id starts the first Fit level of the figure: three cells in a row.
    // A start with the id of the first bundled level of the figure starts that level:
    // the Fit level `fit-<figure>-01` has six cells, and a Sort board of radius 2
    // has 9 squares or 18 triangles.
    it('should_start_the_first_fit_and_sort_levels_of_the_figure_when_the_square_or_the_triangle_is_chosen', async () => {
      const root = testRoot();
      const FIT = GameId.of('hexa-fit');
      const SORT = GameId.of('hexa-sort');
      const started: [string, number, number, number][] = [];

      for (const [figure, name] of [
        [TopologyId.square, 'square'],
        [TopologyId.triangle, 'triangle'],
      ] as const) {
        const fit = root.gameUseCases(FIT, figure).startGame;
        const sort = root.gameUseCases(SORT, figure).startGame;
        const first = valueOf(await fit.execute({}));
        const fitLevel = valueOf(await fit.execute({ levelId: LevelId.of(`fit-${name}-01`) }));
        const sortLevel = valueOf(await sort.execute({ levelId: LevelId.of(`sort-${name}-01`) }));
        started.push([
          name,
          first.freeSpaces.length,
          fitLevel.freeSpaces.length,
          sortLevel.freeSpaces.length,
        ]);
      }

      expect(started).toEqual([
        ['square', 3, 6, 9],
        ['triangle', 3, 6, 18],
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
