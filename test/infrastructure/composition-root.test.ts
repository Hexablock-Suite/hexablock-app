/** @jest-environment node */
import { AchievementCounterListener } from '../../src/adapters/achievement-counter-listener';
import { FitStateMapper } from '../../src/adapters/fit-state-mapper';
import { GameEventBus } from '../../src/adapters/game-event-bus';
import { MergeStateMapper } from '../../src/adapters/merge-state-mapper';
import { SortStateMapper } from '../../src/adapters/sort-state-mapper';
import { LinesStateMapper } from '../../src/adapters/lines-state-mapper';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { Stars } from '../../src/domain/progress/stars';
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
import { delivered } from '../support/engine/value-receiver';
import { MATCH_ID } from '../support/engine/match-id';
import { withGeometryOf } from '../support/engine/geometry-of';
import { ManualClock } from '../support/engine/manual-clock';
import { firstMoveOf } from '../support/engine/variant-game';
import { variantIdOf } from '../support/variants/variant-id';
import { saveIn } from '../support/adapters/saved-progress';

// Issue #162: the composition root wires the layers in one place. It builds the drivers and
// the adapters, the game use cases of each registered game and the aspects around them.
// The tests build it with a manual clock and a recording logger, and render nothing.

const FOUR_VARIANTS = ['hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge'];

function testRoot(logger = new RecordingLogger()): CompositionRoot {
  return new CompositionRoot({ clock: new ManualClock(), logger });
}

// The first valid move of a new game of the registered game `gameId` on the board figure
// `figure`, by default the hexagon. Each match draws a new seed from the random source of the root
// (issue #417). Each test root takes the same manual clock reading, so it draws the same seeds
// in the same order. So a test that plays the move in a game of one root asks a twin root
// for it, after the same starts.
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

  // The first move of a new game of the twin root is valid in the game that `StartGame` of the
  // root opens: both games are the first match of their root, so they start from the same seed.
  it('should_start_each_game_and_accept_one_move_when_the_use_cases_come_from_the_root', async () => {
    const root = testRoot();
    const twin = testRoot();
    const played: string[] = [];

    for (const gameId of root.registry().gameIds()) {
      const { startGame, applyMove } = root.gameUseCases(gameId);
      valueOf(await startGame.execute({}));
      const move = firstMoveIn(twin, gameId);
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

  // Lines (#174), Fit (#175), Sort (#176) and Merge (#177) each have their own screen parts,
  // and the registry has no default parts.
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

  // Issue #181: the root offers `LoadProgress` over its one local progress repository,
  // as it offers `ListAchievements`. A root with no store offers neither.
  it('should_throw_a_range_error_when_a_root_with_no_store_is_asked_for_the_saved_progress', () => {
    const root = testRoot();

    expect(() => root.loadProgress()).toThrow(RangeError);
    expect(() => root.loadProgress()).toThrow(
      'The root has no local store, so it loads no progress.',
    );
  });

  // The read goes through the decorated use case: a saved high score of the device comes back
  // as the progress that keeps it.
  it('should_load_the_saved_progress_of_a_game_when_the_root_has_a_store', async () => {
    const LINES = GameId.of('hexa-lines');
    const store = new InMemoryKeyValueStore();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      store,
    });
    const saved = GameProgress.start(LINES);
    saved.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));
    await saveIn(new LocalProgressRepository(store), saved);

    const result = await root.loadProgress().execute({ gameId: LINES });

    expect(
      result.ok
        ? result.value?.keeps(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }))
        : false,
    ).toBe(true);
  });

  // Issue #410: the request of `LoadProgress` names the game, so the root builds one
  // `LoadProgress`, as it builds one `ListLevels`. Each call gives that one use case,
  // and it reads the saved progress of every game.
  it('should_give_one_load_progress_for_every_game_when_the_root_has_a_store', async () => {
    const LINES = GameId.of('hexa-lines');
    const store = new InMemoryKeyValueStore();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      store,
    });
    const saved = GameProgress.start(LINES);
    saved.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));
    await saveIn(new LocalProgressRepository(store), saved);
    const load = root.loadProgress();

    const lines = await load.execute({ gameId: LINES });
    const merge = await load.execute({ gameId: GameId.of('hexa-merge') });

    expect(root.loadProgress() === load).toBe(true);
    expect(
      lines.ok
        ? lines.value?.keeps(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }))
        : false,
    ).toBe(true);
    expect(merge.ok ? merge.value : 'failed').toBeUndefined();
  });

  // Issue #173: the root builds `ListLevels` once over its one local progress repository,
  // as it builds `ListAchievements`. A root with no store does not offer it.
  it('should_throw_a_range_error_when_a_root_with_no_store_is_asked_for_the_levels', () => {
    const root = testRoot();

    expect(() => root.listLevels()).toThrow(RangeError);
    expect(() => root.listLevels()).toThrow('The root has no local store, so it lists no levels.');
  });

  // The level selector and `LoadProgress` read one saved progress: a won level that the device
  // keeps is completed in the list, and the next level opens (#323).
  it('should_list_the_saved_level_as_completed_when_the_root_has_a_store', async () => {
    const FIT = GameId.of('hexa-fit');
    const store = new InMemoryKeyValueStore();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      store,
    });
    const won = ProgressRecord.of({
      gameId: FIT,
      score: Score.of(0),
      levelId: LevelId.of('fit-01'),
      stars: Stars.of(2),
    });
    const saved = GameProgress.start(FIT);
    saved.recordLevel(won);
    await saveIn(new LocalProgressRepository(store), saved);

    const listed = await root.listLevels().execute({ gameId: FIT, figure: TopologyId.hex });
    const loaded = await root.loadProgress().execute({ gameId: FIT });

    const summaries = listed.ok ? listed.value : [];
    expect(root.listLevels()).toBe(root.listLevels());
    expect(summaries).toHaveLength(15);
    expect(
      summaries
        .slice(0, 3)
        .map(({ levelId, status, stars }) => [
          delivered(levelId),
          [LevelStatus.completed, LevelStatus.open, LevelStatus.locked].findIndex((each) =>
            each.equals(status),
          ),
          stars === undefined ? undefined : delivered(stars),
        ]),
    ).toEqual([
      ['fit-01', 0, 2],
      ['fit-02', 1, undefined],
      ['fit-03', 2, undefined],
    ]);
    expect(loaded.ok ? loaded.value?.keeps(won) : false).toBe(true);
  });

  // Issue #173: the map opens the level selector for a game with levels. The registry entry
  // of each game says whether it has levels: Fit and Sort have them on every figure.
  it('should_mark_only_fit_and_sort_as_games_with_levels_when_the_root_is_built', () => {
    const root = testRoot();

    const marks = root.figures().map((figure) =>
      root
        .registry(figure)
        .gameIds()
        .map((gameId) => [variantIdOf(gameId), root.registry(figure).gameOf(gameId).hasLevels]),
    );

    expect(marks).toEqual(
      root.figures().map(() => [
        ['hexa-lines', false],
        ['hexa-fit', true],
        ['hexa-sort', true],
        ['hexa-merge', false],
      ]),
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
      const twin = testRoot();
      const played: string[][] = [];

      for (const figure of FIGURES) {
        const ids: string[] = [];
        for (const gameId of root.registry(figure).gameIds()) {
          const { startGame, applyMove } = root.gameUseCases(gameId, figure);
          valueOf(await startGame.execute({}));
          valueOf(await applyMove.execute({ move: firstMoveIn(twin, gameId, figure) }));
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
  // after two moves, so each game records one `GameEnded`. The Fit games of the hexagon and of
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

  // Issue #384: a failed save of the counters reaches the logger of the root. The saved counters
  // of Hexa Sort have a version that the app does not read, so the save of a Sort goal fails.
  it('should_log_one_save_failed_entry_through_the_logger_of_the_root_when_a_counter_save_fails', async () => {
    const subscribe = jest.spyOn(GameEventBus.prototype, 'subscribe');
    try {
      const store = new InMemoryKeyValueStore();
      await store.set('achievement-counters:hexa-sort', '{"version":9}');
      const logger = new RecordingLogger();
      new CompositionRoot({ clock: new ManualClock(), logger, store });
      const listener = subscribe.mock.calls[0][0] as AchievementCounterListener;

      listener.onEvent(new StackCleared(GameId.of('hexa-sort'), MATCH_ID, 0, TileCount.of(6)));
      await listener.saved();

      expect(
        logger.entries.map(({ useCase, outcome, error }) => ({
          useCase,
          outcome,
          code: error?.code,
          message: error?.message,
        })),
      ).toEqual([
        {
          useCase: 'AchievementCounterListener',
          outcome: 'failure',
          code: 'save-failed',
          message:
            'The saved counters of the achievements of a game have a version that this app does not read.',
        },
      ]);
      await expect(store.get('achievement-counters:hexa-sort')).resolves.toBe('{"version":9}');
    } finally {
      subscribe.mockRestore();
    }
  });

  // Issue #363: a root with no local store has no place to save the counters,
  // so it subscribes no counter listener. Its bus still takes the events of every move.
  it('should_subscribe_no_counter_listener_when_the_root_has_no_local_store', async () => {
    const subscribe = jest.spyOn(GameEventBus.prototype, 'subscribe');
    try {
      const root = testRoot();
      const twin = testRoot();
      const { startGame, applyMove } = root.gameUseCases(GameId.of('hexa-lines'));
      valueOf(await startGame.execute({}));

      valueOf(await applyMove.execute({ move: firstMoveIn(twin, GameId.of('hexa-lines')) }));

      expect(subscribe).not.toHaveBeenCalled();
    } finally {
      subscribe.mockRestore();
    }
  });

  // Issue #172 (S3-13 in #151, option D): the root builds one `StartGame` for each game,
  // and its `GameFactories` port gives the factory of a bundled level by its id.
  describe('levels', () => {
    // `fit-02` has seven cells. The Fit level of a start with no level id has three.
    // Since #397 `StartGame` reads the saved progress of the one progress repository of the root,
    // the repository of `ListLevels`: the device keeps a won `fit-01`, so `fit-02` is open
    // and `fit-03` is locked.
    it('should_start_the_open_bundled_level_and_refuse_the_locked_one_when_the_start_game_of_the_root_gets_their_level_ids', async () => {
      const FIT = GameId.of('hexa-fit');
      const store = new InMemoryKeyValueStore();
      const root = new CompositionRoot({
        clock: new ManualClock(),
        logger: new RecordingLogger(),
        store,
      });
      const saved = GameProgress.start(FIT);
      saved.recordLevel(
        ProgressRecord.of({
          gameId: FIT,
          score: Score.of(0),
          levelId: LevelId.of('fit-01'),
          stars: Stars.of(2),
        }),
      );
      await saveIn(new LocalProgressRepository(store), saved);
      const { startGame } = root.gameUseCases(FIT);

      const started = valueOf(await startGame.execute({ levelId: LevelId.of('fit-02') }));
      const locked = errorOf(await startGame.execute({ levelId: LevelId.of('fit-03') }));

      expect(started.freeSpaces).toHaveLength(7);
      expect([locked.code, locked.message]).toEqual(['level-locked', 'The level is locked.']);
    });

    // Issue #397: a root with no store has no saved progress, so only the first level
    // of the figure is open, as `LevelStatus.ofEach()` gives it with no progress.
    it('should_start_only_the_first_level_when_the_root_has_no_store', async () => {
      const { startGame } = testRoot().gameUseCases(GameId.of('hexa-fit'));

      const first = valueOf(await startGame.execute({ levelId: LevelId.of('fit-01') }));
      const second = errorOf(await startGame.execute({ levelId: LevelId.of('fit-02') }));

      expect(first.freeSpaces).toHaveLength(6);
      expect(second.code).toBe('level-locked');
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
