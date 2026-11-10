/** @jest-environment node */
import { ApplyMove } from '../../src/application/apply-move';
import type { RunningGameStore } from '../../src/application/running-game-store';
import { StartGame } from '../../src/application/start-game';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { GameEngine } from '../../src/domain/engine/game-engine';
import {
  GameOver,
  type GameEvent,
  type GameEventPublisher,
} from '../../src/domain/engine/game-events';
import { GameFactory } from '../../src/domain/engine/game-factory';
import { GameId } from '../../src/domain/engine/game-id';
import { PlayingPhase, VictoryPhase } from '../../src/domain/engine/game-phase';
import { MoveHistory } from '../../src/domain/engine/move-history';
import type { Piece } from '../../src/domain/engine/piece';
import { FixedListPieceSource, type IPieceSource } from '../../src/domain/engine/piece-source';
import { RegionSize } from '../../src/domain/engine/region-size';
import type { Resolution } from '../../src/domain/engine/resolution';
import { SquareGeometry } from '../../src/domain/engine/square-geometry';
import type { IRedoable } from '../../src/domain/engine/undo-capabilities';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import type { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../src/domain/variants/hexa-sort/sort-factory';
import { phaseNameOf } from '../support/engine/phase-name';
import { square, type SquareCoord } from '../support/engine/square-topology';
import { firstValidMove } from '../support/engine/variant-game';
import { variantIdOf } from '../support/variants/variant-id';
import {
  errorOf,
  gameUseCases,
  MemoryRunningGameStore,
  valueOf,
} from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import type { UseCaseLogEntry } from '../../src/application/logger';
import { fakeCell, type FakeCell } from '../support/engine/fake-cell';
import {
  emptyState,
  fakeGameFactory,
  FakeRules,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
  type FakeState,
} from '../support/engine/fake-game';
import { A, fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory, stack, stackPiece } from '../support/variants/hexa-sort/sort-game';
import { CountingMatchIds, MATCH_ID } from '../support/engine/match-id';

// `StartGame` and `ApplyMove` run the four variants through one code path (issue 100,
// APP-FR-03, classes.md decisions 9, 28 and 29). The helper reads only `IVariantFactory`.

async function startAndPlayOnce<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, startGame, applyMove } = gameUseCases(factory);
  const started = valueOf(await startGame.execute({}));
  const startState = games.running().snapshot();
  const startCells = startState.board.cells();
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
  const played = valueOf(await applyMove.execute({ move }));
  const after = games.running().snapshot();
  return { gameId: variantIdOf(factory.gameId), started, startState, startCells, played, after };
}

class ThrowingPublisher implements GameEventPublisher {
  publish(_event: GameEvent): void {
    throw new Error('The event bus is down.');
  }
}

// A logger that fails on every entry.
class BrokenLogger extends RecordingLogger {
  override log(_entry: UseCaseLogEntry): void {
    throw new Error('The log is down.');
  }
}

// Rules that throw in `resolve()`, before the engine saves the turn.
class ResolveThrowingRules extends FakeRules {
  override resolve(_state: FakeState): Resolution<FakeState> {
    throw new Error('The rules broke.');
  }
}

// The answers to the first Fit move and to one more move, as code and message.
async function twoMoves(events: GameEventPublisher) {
  const factory = fitFactory();
  const { games, startGame, applyMove } = gameUseCases(factory, events);
  valueOf(await startGame.execute({}));
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
  const answers = [];
  for (let call = 0; call < 2; call += 1) {
    const result = await applyMove.execute({ move });
    answers.push(
      result.ok
        ? ['success', result.value.outcome]
        : ['failure', result.error.code, result.error.message],
    );
  }
  return answers;
}

// A factory whose first state throws, as a broken level would.
function brokenStart<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(
  factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
): IVariantFactory<TCell, TCoord, TMove, TState, TPiece> {
  return {
    gameId: factory.gameId,
    createRules: () => factory.createRules(),
    createScoring: () => factory.createScoring(),
    createPieceSource: () => factory.createPieceSource(),
    createBoard: () => factory.createBoard(),
    createInitialState: () => {
      throw new RangeError('The level is broken.');
    },
    createHistory: () => factory.createHistory(),
  };
}

// A store whose `current()` or `replace()` throws, as a broken storage adapter would.
class ThrowingStore<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements RunningGameStore<TCell, TCoord, TMove, TState> {
  constructor(private readonly failing: 'current' | 'replace') {}

  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined {
    if (this.failing === 'current') throw new Error('The store cannot read.');
    return undefined;
  }

  replace(_game: GameEngine<TCell, TCoord, TMove, TState>): void {
    if (this.failing === 'replace') throw new Error('The store cannot write.');
  }
}

// The cells, the score and the phase of the running game, so a test compares them by value.
function runningGameOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(games: MemoryRunningGameStore<TCell, TCoord, TMove, TState>) {
  const engine = games.running();
  return [
    engine.snapshot().board.cells(),
    engine.snapshot().score,
    phaseNameOf(engine.currentPhase()),
  ];
}

// Starts one game and plays `undefined` and then `null` as the move.
async function playNoMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, startGame, applyMove } = gameUseCases(factory);
  valueOf(await startGame.execute({}));
  const before = runningGameOf(games);
  const ok: boolean[] = [];
  for (const move of [undefined, null]) {
    ok.push((await applyMove.execute({ move: move as TMove })).ok);
  }
  return { ok, before, after: runningGameOf(games) };
}

// A Sort level whose source throws in `clone()`, as a broken level source would.
// The real sources never throw there, so this double stands in for the level data.
function sortLevelWithUncloneableSource(): SortFactory<SquareCoord> {
  const pieces = new FixedListPieceSource([stack('red')].map(stackPiece));
  const source: IPieceSource<Piece<ColorStack, SquareCoord>> = {
    hasNext: () => pieces.hasNext(),
    next: () => pieces.next(),
    [Symbol.iterator]: () => pieces[Symbol.iterator](),
    clone: () => {
      throw new RangeError('The level source cannot be copied.');
    },
  };
  return new SortFactory(new SquareGeometry(), {
    size: RegionSize.of(2),
    source,
    goalsNeeded: GoalCount.of(1),
  });
}

describe('StartGame and ApplyMove', () => {
  it('should_start_and_play_each_variant_through_the_same_path_when_the_use_cases_get_the_four_factories', async () => {
    const runs = [
      await startAndPlayOnce(linesFactory()),
      await startAndPlayOnce(fitFactory()),
      await startAndPlayOnce(sortFactory()),
      await startAndPlayOnce(mergeFactory()),
    ];

    expect(runs.map((r) => [r.gameId, r.started.outcome, r.played.outcome])).toEqual([
      ['hexa-lines', 'playing', 'playing'],
      ['hexa-fit', 'playing', 'victory'],
      ['hexa-sort', 'playing', 'playing'],
      ['hexa-merge', 'playing', 'playing'],
    ]);
    for (const run of runs) {
      // Fit wins with its one move, so only the Merge game keeps a move to undo.
      const hasUndo = run.gameId === 'hexa-fit' || run.gameId === 'hexa-merge';
      // Only Fit is timed, and this clock does not move.
      const time = run.gameId === 'hexa-fit' ? { elapsedMs: 0 } : {};
      expect(run.started).toEqual({
        cells: run.startCells,
        score: 0,
        outcome: 'playing',
        canUndo: false,
        canRedo: false,
        hasUndo,
        payload: run.startState.view(),
        ...time,
      });
      expect(run.played).toEqual({
        cells: run.after.board.cells(),
        score: run.after.score,
        outcome: run.played.outcome,
        canUndo: run.gameId === 'hexa-merge',
        canRedo: false,
        hasUndo,
        payload: run.after.view(),
        ...time,
      });
    }
    // Merge starts with two tiles, so the start result carries the cells of the board.
    expect(runs[3].started.cells).toHaveLength(2);
  });

  it('should_return_a_start_failed_failure_and_keep_no_game_when_the_factory_throws', async () => {
    const { games, startGame } = gameUseCases(brokenStart(fitFactory()));

    const error = errorOf(await startGame.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The level is broken.',
      false,
    ]);
    expect(games.current()).toBeUndefined();
  });

  it('should_return_a_start_failed_failure_and_keep_no_game_when_the_sort_level_source_cannot_be_cloned', async () => {
    // `SortFactory` clones the level source for each game, so the clone error stops the start.
    const factory = sortLevelWithUncloneableSource();
    const { games, startGame } = gameUseCases(factory);

    const error = errorOf(await startGame.execute({}));

    expect(() => factory.createInitialState()).toThrow(
      new RangeError('The level source cannot be copied.'),
    );

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The level source cannot be copied.',
      false,
    ]);
    expect(games.current()).toBeUndefined();
  });

  it('should_return_a_start_failed_failure_and_keep_the_old_game_when_the_factory_throws_while_a_game_runs', async () => {
    const { games, startGame, applyMove } = gameUseCases(linesFactory());
    valueOf(await startGame.execute({}));
    const move = firstValidMove(linesFactory().createRules(), games.running().snapshot());
    valueOf(await applyMove.execute({ move }));
    const oldGame = games.running();
    const before = runningGameOf(games);
    const broken = new StartGame(
      new GameFactory(
        brokenStart(linesFactory()),
        new CountingMatchIds(),
        new RecordingPublisher(),
      ),
      games,
    );

    const error = errorOf(await broken.execute({}));

    expect([error.code, error.message]).toEqual(['start-failed', 'The level is broken.']);
    expect(games.current()).toBe(oldGame);
    expect(runningGameOf(games)).toEqual(before);
  });

  // Unit R6 of the redesign: each game has its own `MatchId`, which an injected generator gives.
  it('should_open_another_match_when_the_same_variant_starts_again', async () => {
    const { games, startGame } = gameUseCases(linesFactory());
    valueOf(await startGame.execute({}));
    const first = games.running();

    valueOf(await startGame.execute({}));
    const second = games.running();

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([first.equals(first), second.equals(second)]).toEqual([true, true]);
  });

  it('should_publish_game_over_with_the_id_of_the_generator_when_the_started_game_ends', async () => {
    const publisher = new RecordingPublisher();
    const factory = fitFactory();
    const { games, startGame, applyMove } = gameUseCases(
      factory,
      publisher,
      new RecordingLogger(),
      {
        next: () => MATCH_ID,
      },
    );
    valueOf(await startGame.execute({}));
    const move = firstValidMove(factory.createRules(), games.running().snapshot());

    const played = valueOf(await applyMove.execute({ move }));

    expect(played.outcome).toBe('victory');
    expect(publisher.events).toEqual([new GameOver(factory.gameId, MATCH_ID, 'victory', 0)]);
  });

  it('should_return_a_start_failed_failure_and_keep_the_old_game_when_the_id_generator_throws', async () => {
    const working = gameUseCases(linesFactory());
    valueOf(await working.startGame.execute({}));
    const oldGame = working.games.running();
    const before = runningGameOf(working.games);
    const broken = new StartGame(
      new GameFactory(
        linesFactory(),
        {
          next: () => {
            throw new Error('The generator has no id.');
          },
        },
        new RecordingPublisher(),
      ),
      working.games,
    );

    const error = errorOf(await broken.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The generator has no id.',
      false,
    ]);
    expect(working.games.current()).toBe(oldGame);
    expect(runningGameOf(working.games)).toEqual(before);
  });

  it('should_return_a_failure_and_keep_the_game_when_the_request_holds_no_move', async () => {
    // Only a cast passes no move. The failure code depends on the rules of the variant,
    // so the test checks only that the use case returns a failure and throws nothing.
    const runs = [
      await playNoMove(linesFactory()),
      await playNoMove(fitFactory()),
      await playNoMove(sortFactory()),
      await playNoMove(mergeFactory()),
    ];

    for (const run of runs) {
      expect(run.ok).toEqual([false, false]);
      expect(run.after).toEqual(run.before);
    }
  });

  it('should_return_a_move_failed_failure_when_the_store_throws_on_current', async () => {
    const applyMove = new ApplyMove(new ThrowingStore('current'), new RecordingLogger());

    const error = errorOf(await applyMove.execute({ move: new PlacePiece(0, square(0, 0)) }));

    expect([error.code, error.message, error.retryable]).toEqual([
      'move-failed',
      'The store cannot read.',
      false,
    ]);
  });

  it('should_return_a_start_failed_failure_when_the_store_throws_on_replace', async () => {
    const startGame = new StartGame(
      new GameFactory(linesFactory(), new CountingMatchIds(), new RecordingPublisher()),
      new ThrowingStore('replace'),
    );

    const error = errorOf(await startGame.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The store cannot write.',
      false,
    ]);
  });

  it('should_return_a_move_rejected_failure_and_keep_the_board_when_the_rules_reject_the_move', async () => {
    const { games, startGame, applyMove } = gameUseCases(linesFactory());
    valueOf(await startGame.execute({}));
    const before = games.running().snapshot();

    const error = errorOf(await applyMove.execute({ move: new PlacePiece(0, square(9, 9)) }));

    expect([error.code, error.retryable]).toEqual(['move-rejected', false]);
    const after = games.running().snapshot();
    expect([after.board.cells(), after.score, after.tray]).toEqual([
      before.board.cells(),
      before.score,
      before.tray,
    ]);
    expect(games.running().currentPhase()).toBe(PlayingPhase.instance);
  });

  it('should_return_a_no_running_game_failure_when_apply_move_runs_before_start_game', async () => {
    const { applyMove } = gameUseCases(linesFactory());

    const error = errorOf(await applyMove.execute({ move: new PlacePiece(0, square(0, 0)) }));

    expect([error.code, error.retryable]).toEqual(['no-running-game', false]);
  });

  it('should_return_a_move_failed_failure_and_throw_nothing_when_the_engine_throws', async () => {
    // The game is over after the first Fit move, so a second move makes the engine throw.
    const factory = fitFactory();
    const { games, startGame, applyMove } = gameUseCases(factory);
    valueOf(await startGame.execute({}));
    const move = firstValidMove(factory.createRules(), games.running().snapshot());
    valueOf(await applyMove.execute({ move }));

    const error = errorOf(await applyMove.execute({ move }));

    expect([error.code, error.retryable]).toEqual(['move-failed', false]);
    expect(error.message).toMatch(/cannot accept a move/);
  });

  // The engine saves the turn before it publishes, so the answer shows the saved turn
  // and the publisher failure goes to the log (issue 132, G117.2, classes.md decision 29).
  it('should_return_the_saved_turn_and_log_the_publisher_failure_when_the_publisher_throws_after_the_turn_is_saved', async () => {
    const factory = fitFactory();
    const { games, logger, startGame, applyMove } = gameUseCases(factory, new ThrowingPublisher());
    valueOf(await startGame.execute({}));
    const move = firstValidMove(factory.createRules(), games.running().snapshot());

    const played = valueOf(await applyMove.execute({ move }));

    const saved = games.running().snapshot();
    expect(played).toEqual({
      cells: saved.board.cells(),
      score: saved.score,
      outcome: 'victory',
      canUndo: false,
      canRedo: false,
      hasUndo: true,
      payload: saved.view(),
      elapsedMs: 0,
    });
    expect(saved.board.cells()).not.toEqual([]);
    expect(games.running().currentPhase()).toBe(VictoryPhase.instance);
    expect(logger.entries).toHaveLength(1);
    const [entry] = logger.entries;
    expect([entry.useCase, entry.outcome, entry.error?.code, entry.error?.message]).toEqual([
      'ApplyMove',
      'failure',
      'publish-failed',
      'The event bus is down.',
    ]);
    expect(entry.error?.cause).toEqual(new Error('The event bus is down.'));
  });

  // The answer tells what the engine saved, so a logger that throws cannot turn it into
  // move-failed (decision 29). A logging aspect around the call reports the broken logger.
  it('should_return_the_saved_turn_when_the_logger_throws_after_a_publisher_failure', async () => {
    const factory = fitFactory();
    const { games, startGame, applyMove } = gameUseCases(
      factory,
      new ThrowingPublisher(),
      new BrokenLogger(),
    );
    valueOf(await startGame.execute({}));
    const move = firstValidMove(factory.createRules(), games.running().snapshot());

    const played = valueOf(await applyMove.execute({ move }));

    expect(played.outcome).toBe('victory');
    expect(played.cells).toEqual(games.running().snapshot().board.cells());
    expect(games.running().currentPhase()).toBe(VictoryPhase.instance);
  });

  it('should_answer_the_next_move_as_a_finished_game_does_when_the_publisher_threw_on_the_last_turn', async () => {
    // A finished game refuses the next move. The publisher failure adds no other failure.
    const withThrowingPublisher = await twoMoves(new ThrowingPublisher());
    const withWorkingPublisher = await twoMoves(new RecordingPublisher());

    expect(withThrowingPublisher).toEqual(withWorkingPublisher);
    expect(withWorkingPublisher).toEqual([
      ['success', 'victory'],
      ['failure', 'move-failed', 'The game cannot accept a move in the victory phase.'],
    ]);
  });

  it('should_return_a_move_failed_failure_and_log_nothing_when_the_rules_throw_before_the_turn_is_saved', async () => {
    const games = new MemoryRunningGameStore<FakeCell, SquareCoord, FakeMove, FakeState>();
    const publisher = new RecordingPublisher();
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new ResolveThrowingRules(),
      new OnePointScoring(),
      publisher,
    );
    engine.start(emptyState());
    games.replace(engine);
    const logger = new RecordingLogger();

    const error = errorOf(
      await new ApplyMove(games, logger).execute({
        move: { at: square(0, 0), cell: fakeCell(1) },
      }),
    );

    expect([error.code, error.message, error.retryable]).toEqual([
      'move-failed',
      'The rules broke.',
      false,
    ]);
    expect(engine.snapshot().board.cells()).toEqual([]);
    expect([engine.snapshot().score, phaseNameOf(engine.currentPhase())]).toEqual([0, 'playing']);
    expect([logger.entries, publisher.events]).toEqual([[], []]);
  });

  it('should_leave_the_engine_unchanged_when_a_caller_changes_the_cells_of_a_move_result', async () => {
    const { games, startGame } = gameUseCases(mergeFactory());
    const started = valueOf(await startGame.execute({}));
    const before = games.running().snapshot().board.cells();

    started.cells[0][0] = started.cells[1][0];
    started.cells.pop();
    started.cells.push(...before);

    expect(games.running().snapshot().board.cells()).toEqual(before);
    expect(Object.keys(started).sort()).toEqual([
      'canRedo',
      'canUndo',
      'cells',
      'hasUndo',
      'outcome',
      'payload',
      'score',
    ]);
  });
});

// A history that can redo, as the factory of a redo variant gives it.
class RedoingHistory extends MoveHistory<FakeMove, FakeState> implements IRedoable {
  override redoable(): IRedoable {
    return this;
  }

  canRedo(): boolean {
    return true;
  }

  redo(): void {
    return;
  }
}

// Tries to change each list and each field of a payload, in depth.
// A frozen part refuses the write: a list method throws, and a field write does nothing
// because jest-expo compiles in sloppy mode. A class instance is a value object that never
// changes (classes.md decisions 6 and 29), so this function does not go inside it.
function tryToChange(payload: unknown): void {
  if (Array.isArray(payload)) {
    payload.forEach(tryToChange);
    try {
      payload.pop();
    } catch {
      return;
    }
    return;
  }
  if (typeof payload !== 'object' || payload === null) return;
  if (Object.getPrototypeOf(payload) !== Object.prototype) return;
  const fields = payload as Record<string, unknown>;
  for (const name of Object.keys(fields)) {
    tryToChange(fields[name]);
    try {
      fields[name] = 'changed';
    } catch {
      continue;
    }
  }
}

// Starts one game, tries to change the payload of the answer and reads the running game.
async function changedPayloadRun<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, startGame } = gameUseCases(factory);
  const started = valueOf(await startGame.execute({}));
  const read = () => [runningGameOf(games), games.running().snapshot().view()];
  const before = read();
  tryToChange(started.payload);
  return { before, after: read() };
}

// The variant data of `MoveResult` (issue 158, classes.md decisions 14 and 29).
describe('the variant data of MoveResult', () => {
  it('should_copy_the_view_of_the_saved_state_into_the_payload_when_the_use_cases_answer_a_game_they_do_not_name', async () => {
    const { games, startGame, applyMove } = gameUseCases(fakeGameFactory());

    const started = valueOf(await startGame.execute({}));
    const played = valueOf(
      await applyMove.execute({ move: { at: square(0, 0), cell: fakeCell(1) } }),
    );

    expect(started.payload).toEqual({ filled: 0 });
    expect(played.payload).toEqual({ filled: 1 });
    expect(played.payload).toEqual(games.running().snapshot().view());
  });

  it('should_give_each_payload_field_the_value_of_the_state_when_each_variant_starts_and_plays', async () => {
    // Each field is read by name, so `pnpm typecheck` also proves that the state types the payload.
    const lines = await startAndPlayOnce(linesFactory());
    expect(lines.started.payload.tray).toEqual(lines.startState.tray);
    expect(lines.played.payload.tray).toEqual(lines.after.tray);

    const fit = await startAndPlayOnce(fitFactory());
    expect(fit.started.payload.remaining).toEqual(fit.startState.remaining());
    expect(fit.started.payload.placed).toEqual(fit.startState.placed());
    expect(fit.played.payload.remaining).toEqual(fit.after.remaining());
    expect(fit.played.payload.placed).toEqual(fit.after.placed());
    expect(fit.after.placed()).toEqual([A]);

    const sort = await startAndPlayOnce(sortFactory());
    expect(sort.started.payload.offered).toEqual(sort.startState.offered);
    expect(sort.started.payload.goalsDone).toBe(sort.startState.goalsDone);
    expect(sort.started.payload.goalsNeeded).toEqual(sort.startState.goalsNeeded);
    expect(sort.played.payload.offered).toEqual(sort.after.offered);
    expect(sort.played.payload.goalsDone).toBe(sort.after.goalsDone);
    expect(sort.played.payload.goalsNeeded).toEqual(sort.after.goalsNeeded);
    expect(sort.after.offered).not.toEqual(sort.startState.offered);

    const merge = await startAndPlayOnce(mergeFactory());
    expect(merge.started.payload.targetReached).toBe(merge.startState.targetReached);
    expect(merge.played.payload.targetReached).toBe(merge.after.targetReached);
  });

  it('should_keep_the_running_game_when_a_caller_changes_the_payload_of_a_move_result', async () => {
    const runs = [
      await changedPayloadRun(linesFactory()),
      await changedPayloadRun(fitFactory()),
      await changedPayloadRun(sortFactory()),
      await changedPayloadRun(mergeFactory()),
    ];

    for (const run of runs) expect(run.after).toEqual(run.before);
  });

  it('should_report_the_undo_of_each_variant_when_it_starts_and_plays', async () => {
    const runs = [
      await startAndPlayOnce(linesFactory()),
      await startAndPlayOnce(fitFactory()),
      await startAndPlayOnce(sortFactory()),
      await startAndPlayOnce(mergeFactory()),
    ];

    expect(
      runs.map((run) => [
        run.gameId,
        run.started.hasUndo,
        run.started.canUndo,
        run.played.hasUndo,
        run.played.canUndo,
        run.played.canRedo,
      ]),
    ).toEqual([
      ['hexa-lines', false, false, false, false, false],
      // The one Fit move wins the level, and a finished game has no move to undo.
      ['hexa-fit', true, false, true, false, false],
      ['hexa-sort', false, false, false, false, false],
      ['hexa-merge', true, false, true, true, false],
    ]);
  });

  it('should_report_the_redo_capability_of_the_history_when_a_history_can_redo', async () => {
    const factory = { ...fakeGameFactory(), createHistory: () => new RedoingHistory() };
    const { startGame } = gameUseCases(factory);

    const started = valueOf(await startGame.execute({}));

    expect([started.hasUndo, started.canUndo, started.canRedo]).toEqual([true, false, true]);
  });
});
