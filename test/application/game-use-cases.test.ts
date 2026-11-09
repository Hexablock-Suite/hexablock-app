/** @jest-environment node */
import { ApplyMove } from '../../src/application/apply-move';
import type { RunningGameStore } from '../../src/application/running-game-store';
import { StartGame } from '../../src/application/start-game';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { GameEngine } from '../../src/domain/engine/game-engine';
import type { GameEvent, GameEventPublisher } from '../../src/domain/engine/game-events';
import { GameId } from '../../src/domain/engine/game-id';
import type { Piece } from '../../src/domain/engine/piece';
import { FixedListPieceSource, type IPieceSource } from '../../src/domain/engine/piece-source';
import { RegionSize } from '../../src/domain/engine/region-size';
import type { Resolution } from '../../src/domain/engine/resolution';
import { SquareGeometry } from '../../src/domain/engine/square-geometry';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import type { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../src/domain/variants/hexa-sort/sort-factory';
import { square, type SquareCoord } from '../support/engine/square-topology';
import { firstValidMove } from '../support/engine/variant-game';
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
  FakeRules,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
  type FakeState,
} from '../support/engine/fake-game';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory, stack, stackPiece } from '../support/variants/hexa-sort/sort-game';

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
  const startCells = games.running().snapshot().board.cells();
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
  const played = valueOf(await applyMove.execute({ move }));
  const after = games.running().snapshot();
  return { gameId: factory.gameId.value, started, startCells, played, after };
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
  return [engine.snapshot().board.cells(), engine.snapshot().score, engine.phase.name];
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
      expect(run.started).toEqual({
        cells: run.startCells,
        score: 0,
        outcome: 'playing',
        canUndo: false,
        canRedo: false,
      });
      expect(run.played).toEqual({
        cells: run.after.board.cells(),
        score: run.after.score,
        outcome: run.played.outcome,
        canUndo: false,
        canRedo: false,
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
    const broken = new StartGame(brokenStart(linesFactory()), games, new RecordingPublisher());

    const error = errorOf(await broken.execute({}));

    expect([error.code, error.message]).toEqual(['start-failed', 'The level is broken.']);
    expect(games.current()).toBe(oldGame);
    expect(runningGameOf(games)).toEqual(before);
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
      linesFactory(),
      new ThrowingStore('replace'),
      new RecordingPublisher(),
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
    expect(games.running().phase.name).toBe('playing');
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
    });
    expect(saved.board.cells()).not.toEqual([]);
    expect(games.running().phase.name).toBe('victory');
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
    expect(games.running().phase.name).toBe('victory');
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
    expect([engine.snapshot().score, engine.phase.name]).toEqual([0, 'playing']);
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
      'outcome',
      'score',
    ]);
  });
});
