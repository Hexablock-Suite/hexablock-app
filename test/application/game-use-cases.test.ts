/** @jest-environment node */
import { Outcome } from '../../src/domain/engine/outcome';
import { ApplyMove } from '../../src/application/apply-move';
import type { GameEventPublisher } from '../../src/application/game-event-publisher';
import type { GameRepository } from '../../src/application/game-repository';
import { StartGame } from '../../src/application/start-game';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { GameEngine } from '../../src/domain/engine/game-engine';
import type { GameEvent } from '../../src/domain/engine/game-events';
import { GameFactory } from '../../src/domain/engine/game-factory';
import { GameId } from '../../src/domain/engine/game-id';
import { MatchId } from '../../src/domain/engine/match-id';
import { PlayingPhase, VictoryPhase, type GamePhase } from '../../src/domain/engine/game-phase';
import { MoveHistory } from '../../src/domain/engine/move-history';
import { hex } from '../../src/domain/engine/hex-topology';
import { Piece } from '../../src/domain/engine/piece';
import { CellNode } from '../../src/domain/engine/shape-node';
import { FixedListPieceSource, type IPieceSource } from '../../src/domain/engine/piece-source';
import type { Resolution } from '../../src/domain/engine/resolution';
import { ElapsedTime } from '../../src/domain/engine/elapsed-time';
import { Score } from '../../src/domain/engine/score';
import type { IRedoable } from '../../src/domain/engine/undo-capabilities';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import { ClearedStacks } from '../../src/domain/variants/hexa-sort/cleared-stacks';
import type { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import type { PlaceStack } from '../../src/domain/variants/hexa-sort/place-stack';
import { SortState } from '../../src/domain/variants/hexa-sort/sort-state';
import { dataOf, type GameOverData } from '../support/engine/game-over';
import { phaseNameOf } from '../support/engine/phase-name';
import { square, type SquareCoord } from '../support/engine/square-topology';
import { firstMoveOf, gameIdOf } from '../support/engine/variant-game';
import { variantIdOf } from '../support/variants/variant-id';
import {
  errorOf,
  gameUseCases,
  MemoryGameRepository,
  valueOf,
} from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { RecordingPublisher } from '../support/application/recording-publisher';
import type { UseCaseLogEntry } from '../../src/application/logger';
import { fakeCell, type FakeCell } from '../support/engine/fake-cell';
import {
  emptyState,
  fakeGameFactory,
  FakeRules,
  OnePointScoring,
  type FakeMove,
  type FakeState,
  type FakeSnapshot,
} from '../support/engine/fake-game';
import { A, fitFactory, fitStateOf } from '../support/variants/hexa-fit/fit-game';
import { linesFactory, red } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory, stack, stackPiece } from '../support/variants/hexa-sort/sort-game';
import { CountingMatchIds, MATCH_ID } from '../support/engine/match-id';
import {
  fitViewData,
  linesViewData,
  mergeViewData,
  sortViewData,
  viewData,
} from '../support/variants/view-data';
import { BOARD_ID, STATE_ID } from '../support/engine/entity-ids';

// `StartGame` and `ApplyMove` run the four variants through one code path (issue 100,
// APP-FR-03, classes.md decisions 9, 28 and 29). The helper reads only `IVariantFactory`.

// The id of Hexa Lines, as the composition root gives it to `GameFactory` (issue #234).
const LINES = GameId.of('hexa-lines');

// The match of the first game that `gameUseCases()` starts: its generator counts from 1.
const FIRST_MATCH = MatchId.of('match-1');

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
  const startCells = startState.boardCopy().occupiedCells();
  const move = firstMoveOf(factory);
  const played = valueOf(await applyMove.execute({ move }));
  const after = games.running().snapshot();
  return { gameId: variantIdOf(gameIdOf(factory)), started, startState, startCells, played, after };
}

class ThrowingPublisher implements GameEventPublisher {
  publish(_event: GameEvent): void {
    throw new Error('The event bus is down.');
  }
}

// A publisher that notes the phase of the running game when it receives an event.
// So a test sees whether `ApplyMove` delivers the event after the engine saves the turn.
class PhaseReadingPublisher implements GameEventPublisher {
  readonly received: [GameOverData, string][] = [];
  private games: { running(): { currentPhase(): GamePhase } } | undefined;

  watch(games: { running(): { currentPhase(): GamePhase } }): void {
    this.games = games;
  }

  publish(event: GameEvent): void {
    const phase = this.games?.running().currentPhase();
    this.received.push([dataOf(event), phase === undefined ? 'none' : phaseNameOf(phase)]);
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
  override resolve(_state: FakeState): Resolution {
    throw new Error('The rules broke.');
  }
}

// The answers to the first Fit move and to one more move, as code and message.
async function twoMoves(events: GameEventPublisher) {
  const factory = fitFactory();
  const { startGame, applyMove } = gameUseCases(factory, events);
  valueOf(await startGame.execute({}));
  const move = firstMoveOf(factory);
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
    isFor: (gameId) => factory.isFor(gameId),
    createRules: () => factory.createRules(),
    createTimer: (matchId) => factory.createTimer(matchId),
    createScoring: () => factory.createScoring(),
    createPieceSource: () => factory.createPieceSource(),
    createBoard: (boardId) => factory.createBoard(boardId),
    createInitialState: () => {
      throw new RangeError('The level is broken.');
    },
    createHistory: () => factory.createHistory(),
  };
}

// A repository whose `current()` or `replace()` throws, as a broken storage adapter would.
class ThrowingRepository<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements GameRepository<TCell, TCoord, TMove, TState> {
  constructor(private readonly failing: 'current' | 'replace') {}

  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined {
    if (this.failing === 'current') throw new Error('The repository cannot read.');
    return undefined;
  }

  replace(_game: GameEngine<TCell, TCoord, TMove, TState>): void {
    if (this.failing === 'replace') throw new Error('The repository cannot write.');
  }
}

// The cells, the score and the phase of the running game, so a test compares them by value.
function runningGameOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(games: MemoryGameRepository<TCell, TCoord, TMove, TState>) {
  const engine = games.running();
  return [
    engine.snapshot().boardCopy().occupiedCells(),
    engine.snapshot().scoreSoFar(),
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

// A Sort factory whose first state gets a source that throws in `take()`.
// A `SortLevel` holds only data, and the source that `SortFactory` builds from it never throws
// on the first draw. So this double gives `SortState.start()` a broken source itself.
function sortFactoryWithFailingSource(): IVariantFactory<
  ColorStack,
  SquareCoord,
  PlaceStack<SquareCoord>,
  SortState<SquareCoord>
> {
  const factory = sortFactory();
  const pieces = new FixedListPieceSource([stack('red')].map(stackPiece));
  const source: IPieceSource<Piece<ColorStack, SquareCoord>> = {
    hasNext: () => pieces.hasNext(),
    take: () => {
      throw new RangeError('The level source cannot be read.');
    },
    [Symbol.iterator]: () => pieces[Symbol.iterator](),
  };
  return {
    isFor: (gameId) => factory.isFor(gameId),
    createRules: () => factory.createRules(),
    createTimer: (matchId) => factory.createTimer(matchId),
    createScoring: () => factory.createScoring(),
    createPieceSource: () => source,
    createBoard: (boardId) => factory.createBoard(boardId),
    createInitialState: (matchId, stateId, boardId) =>
      SortState.start({
        stateId,
        matchId,
        board: factory.createBoard(boardId),
        source,
        goalsNeeded: GoalCount.of(1),
      }),
    createHistory: () => factory.createHistory(),
  };
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
      ['hexa-lines', Outcome.playing, Outcome.playing],
      ['hexa-fit', Outcome.playing, Outcome.victory],
      ['hexa-sort', Outcome.playing, Outcome.playing],
      ['hexa-merge', Outcome.playing, Outcome.playing],
    ]);
    for (const run of runs) {
      // Fit wins with its one move, so only the Merge game keeps a move to undo.
      const hasUndo = run.gameId === 'hexa-fit' || run.gameId === 'hexa-merge';
      // Only Fit is timed, and this clock does not move.
      const time = run.gameId === 'hexa-fit' ? { elapsedMs: ElapsedTime.ofMs(0) } : {};
      // A view keeps its fields private, so the test compares the data that it delivers.
      expect({ ...run.started, payload: viewData(run.started.payload) }).toEqual({
        cells: run.startCells,
        freeSpaces: run.startState.boardCopy().freeSpaces(),
        score: Score.of(0),
        outcome: Outcome.playing,
        canUndo: false,
        canRedo: false,
        hasUndo,
        payload: viewData(run.startState.view()),
        ...time,
      });
      expect({ ...run.played, payload: viewData(run.played.payload) }).toEqual({
        cells: run.after.boardCopy().occupiedCells(),
        freeSpaces: run.after.boardCopy().freeSpaces(),
        score: run.after.scoreSoFar(),
        outcome: run.played.outcome,
        canUndo: run.gameId === 'hexa-merge',
        canRedo: false,
        hasUndo,
        payload: viewData(run.after.view()),
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

  it('should_return_a_start_failed_failure_and_keep_no_game_when_the_sort_level_source_throws_on_the_first_draw', async () => {
    // `SortState.start()` draws the first stack of its source, so the draw error stops the start.
    const factory = sortFactoryWithFailingSource();
    const { games, startGame } = gameUseCases(factory);

    const error = errorOf(await startGame.execute({}));

    expect(() => factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID)).toThrow(
      new RangeError('The level source cannot be read.'),
    );

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The level source cannot be read.',
      false,
    ]);
    expect(games.current()).toBeUndefined();
  });

  it('should_return_a_start_failed_failure_and_keep_the_old_game_when_the_factory_throws_while_a_game_runs', async () => {
    const { games, startGame, applyMove } = gameUseCases(linesFactory());
    valueOf(await startGame.execute({}));
    const move = firstMoveOf(linesFactory());
    valueOf(await applyMove.execute({ move }));
    const oldGame = games.running();
    const before = runningGameOf(games);
    const broken = new StartGame(
      new GameFactory(LINES, brokenStart(linesFactory()), new CountingMatchIds()),
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

  // The root only records its event. `ApplyMove` takes it after the turn and delivers it
  // to the publisher port (issue #233, classes.md decisions 25 and 29).
  it('should_deliver_one_game_over_with_the_id_of_the_generator_after_the_turn_when_apply_move_plays_the_last_move', async () => {
    const publisher = new PhaseReadingPublisher();
    const factory = fitFactory();
    const { games, startGame, applyMove } = gameUseCases(
      factory,
      publisher,
      new RecordingLogger(),
      { next: () => MATCH_ID },
    );
    publisher.watch(games);
    valueOf(await startGame.execute({}));
    const move = firstMoveOf(factory);

    const played = valueOf(await applyMove.execute({ move }));

    expect(played.outcome).toBe(Outcome.victory);
    expect(publisher.received).toEqual([
      [
        {
          gameId: GameId.of('hexa-fit'),
          matchId: MATCH_ID,
          outcome: Outcome.victory,
          finalScore: Score.of(0),
        },
        'victory',
      ],
    ]);
    expect(games.running().takeEvents()).toEqual([]);
  });

  it('should_return_a_start_failed_failure_and_keep_the_old_game_when_the_id_generator_throws', async () => {
    const working = gameUseCases(linesFactory());
    valueOf(await working.startGame.execute({}));
    const oldGame = working.games.running();
    const before = runningGameOf(working.games);
    const broken = new StartGame(
      new GameFactory(LINES, linesFactory(), {
        next: () => {
          throw new Error('The generator has no id.');
        },
      }),
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

  it('should_return_a_move_failed_failure_when_the_repository_throws_on_current', async () => {
    const applyMove = new ApplyMove(
      new ThrowingRepository('current'),
      new RecordingLogger(),
      new RecordingPublisher(),
    );

    const error = errorOf(
      await applyMove.execute({ move: new PlacePiece(TrayPosition.of(0), square(0, 0)) }),
    );

    expect([error.code, error.message, error.retryable]).toEqual([
      'move-failed',
      'The repository cannot read.',
      false,
    ]);
  });

  it('should_return_a_start_failed_failure_when_the_repository_throws_on_replace', async () => {
    const startGame = new StartGame(
      new GameFactory(LINES, linesFactory(), new CountingMatchIds()),
      new ThrowingRepository('replace'),
    );

    const error = errorOf(await startGame.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The repository cannot write.',
      false,
    ]);
  });

  it('should_return_a_move_rejected_failure_and_keep_the_board_when_the_rules_reject_the_move', async () => {
    const { games, startGame, applyMove } = gameUseCases(linesFactory());
    valueOf(await startGame.execute({}));
    const before = games.running().snapshot();

    const error = errorOf(
      await applyMove.execute({ move: new PlacePiece(TrayPosition.of(0), square(9, 9)) }),
    );

    expect([error.code, error.retryable]).toEqual(['move-rejected', false]);
    const after = games.running().snapshot();
    expect([after.boardCopy().occupiedCells(), after.scoreSoFar(), after.trayPieces()]).toEqual([
      before.boardCopy().occupiedCells(),
      before.scoreSoFar(),
      before.trayPieces(),
    ]);
    expect(games.running().currentPhase()).toBe(PlayingPhase.instance);
  });

  it('should_return_a_no_running_game_failure_when_apply_move_runs_before_start_game', async () => {
    const { applyMove } = gameUseCases(linesFactory());

    const error = errorOf(
      await applyMove.execute({ move: new PlacePiece(TrayPosition.of(0), square(0, 0)) }),
    );

    expect([error.code, error.retryable]).toEqual(['no-running-game', false]);
  });

  it('should_return_a_move_failed_failure_and_throw_nothing_when_the_engine_throws', async () => {
    // The game is over after the first Fit move, so a second move makes the engine throw.
    const factory = fitFactory();
    const { startGame, applyMove } = gameUseCases(factory);
    valueOf(await startGame.execute({}));
    const move = firstMoveOf(factory);
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
    const move = firstMoveOf(factory);

    const played = valueOf(await applyMove.execute({ move }));

    const saved = games.running().snapshot();
    expect({ ...played, payload: viewData(played.payload) }).toEqual({
      cells: saved.boardCopy().occupiedCells(),
      freeSpaces: saved.boardCopy().freeSpaces(),
      score: saved.scoreSoFar(),
      outcome: Outcome.victory,
      canUndo: false,
      canRedo: false,
      hasUndo: true,
      payload: viewData(saved.view()),
      elapsedMs: ElapsedTime.ofMs(0),
    });
    expect(saved.boardCopy().occupiedCells()).not.toEqual([]);
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
    const move = firstMoveOf(factory);

    const played = valueOf(await applyMove.execute({ move }));

    expect(played.outcome).toBe(Outcome.victory);
    expect(played.cells).toEqual(games.running().snapshot().boardCopy().occupiedCells());
    expect(games.running().currentPhase()).toBe(VictoryPhase.instance);
  });

  it('should_answer_the_next_move_as_a_finished_game_does_when_the_publisher_threw_on_the_last_turn', async () => {
    // A finished game refuses the next move. The publisher failure adds no other failure.
    const withThrowingPublisher = await twoMoves(new ThrowingPublisher());
    const withWorkingPublisher = await twoMoves(new RecordingPublisher());

    expect(withThrowingPublisher).toEqual(withWorkingPublisher);
    expect(withWorkingPublisher).toEqual([
      ['success', Outcome.victory],
      ['failure', 'move-failed', 'The game cannot accept a move in the victory phase.'],
    ]);
  });

  it('should_return_a_move_failed_failure_and_log_nothing_when_the_rules_throw_before_the_turn_is_saved', async () => {
    const games = new MemoryGameRepository<FakeCell, SquareCoord, FakeMove, FakeState>();
    const publisher = new RecordingPublisher();
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new ResolveThrowingRules(),
      new OnePointScoring(),
    );
    engine.start(emptyState());
    games.replace(engine);
    const logger = new RecordingLogger();

    const error = errorOf(
      await new ApplyMove(games, logger, publisher).execute({
        move: { at: square(0, 0), cell: fakeCell(1) },
      }),
    );

    expect([error.code, error.message, error.retryable]).toEqual([
      'move-failed',
      'The rules broke.',
      false,
    ]);
    expect(engine.snapshot().boardCopy().occupiedCells()).toEqual([]);
    expect([engine.snapshot().scoreSoFar(), phaseNameOf(engine.currentPhase())]).toEqual([
      Score.of(0),
      'playing',
    ]);
    expect([logger.entries, publisher.events]).toEqual([[], []]);
  });

  it('should_leave_the_engine_unchanged_when_a_caller_changes_the_cells_of_a_move_result', async () => {
    const { games, startGame } = gameUseCases(mergeFactory());
    const started = valueOf(await startGame.execute({}));
    const before = games.running().snapshot().boardCopy().occupiedCells();

    started.cells[0][0] = started.cells[1][0];
    started.cells.pop();
    started.cells.push(...before);

    expect(games.running().snapshot().boardCopy().occupiedCells()).toEqual(before);
    expect(Object.keys(started).sort()).toEqual([
      'canRedo',
      'canUndo',
      'cells',
      'freeSpaces',
      'hasUndo',
      'outcome',
      'payload',
      'score',
    ]);
  });
});

// Issue #170: a game screen draws every space of the board. So the response carries the free
// spaces of the saved board next to its occupied cells, and the two lists name each space once.
async function freeSpacesRun<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const run = await startAndPlayOnce(factory);
  const named = [...run.played.freeSpaces, ...run.played.cells.map(([at]) => at)];
  return {
    ...run,
    named: named.length,
    distinct: new Set(named.map((at) => run.after.boardCopy().key(at))).size,
    spaces: run.after.boardCopy().coordinates().length,
  };
}

describe('the free spaces of MoveResult', () => {
  it('should_carry_the_free_spaces_of_the_saved_board_when_each_variant_starts_and_plays', async () => {
    const runs = [
      await freeSpacesRun(linesFactory()),
      await freeSpacesRun(fitFactory()),
      await freeSpacesRun(sortFactory()),
      await freeSpacesRun(mergeFactory()),
    ];

    for (const run of runs) {
      expect(run.started.freeSpaces).toEqual(run.startState.boardCopy().freeSpaces());
      expect(run.played.freeSpaces).toEqual(run.after.boardCopy().freeSpaces());
      expect([run.named, run.distinct]).toEqual([run.spaces, run.spaces]);
    }
    // The Merge board of the test has 7 spaces and starts with two tiles, so 5 spaces are free.
    expect(runs[3].started.freeSpaces).toHaveLength(5);
  });

  it('should_leave_the_engine_unchanged_when_a_caller_changes_the_free_spaces_of_a_move_result', async () => {
    const { games, startGame } = gameUseCases(mergeFactory());
    const started = valueOf(await startGame.execute({}));
    const before = games.running().snapshot().boardCopy().freeSpaces();

    started.freeSpaces.splice(0, 3);

    expect(games.running().snapshot().boardCopy().freeSpaces()).toEqual(before);
  });
});

// A history that can redo, as the factory of a redo variant gives it.
class RedoingHistory extends MoveHistory<FakeMove, FakeSnapshot> implements IRedoable {
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
// because jest-expo compiles in sloppy mode. A class instance is a value object or a view
// that never changes (classes.md decisions 6 and 29, issue #245), so this function does not
// go inside it.
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
  const read = () => [runningGameOf(games), viewData(games.running().snapshot().view())];
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
    // Each view goes to the helper of its variant, so `pnpm typecheck` also proves that
    // the state types the payload. A view delivers its data to a receiver (issue #245).
    const lines = await startAndPlayOnce(linesFactory());
    expect(linesViewData(lines.started.payload).tray).toEqual(lines.startState.trayPieces());
    expect(linesViewData(lines.played.payload).tray).toEqual(lines.after.trayPieces());

    const fit = await startAndPlayOnce(fitFactory());
    // The photo gives no tray, so a state built again from it answers the queries.
    const fitStart = fitStateOf(fit.startState, fitFactory().createPieceSource(), FIRST_MATCH);
    const fitAfter = fitStateOf(fit.after, fitFactory().createPieceSource(), FIRST_MATCH);
    const fitStarted = fitViewData(fit.started.payload);
    const fitPlayed = fitViewData(fit.played.payload);
    expect(fitStarted.remaining).toEqual(fitStart.remaining());
    expect(fitStarted.placed).toEqual(fitStart.placed());
    expect(fitPlayed.remaining).toEqual(fitAfter.remaining());
    expect(fitPlayed.placed).toEqual(fitAfter.placed());
    expect(fitAfter.placed()).toEqual([A]);

    const sort = await startAndPlayOnce(sortFactory());
    const sortStarted = sortViewData(sort.started.payload);
    const sortPlayed = sortViewData(sort.played.payload);
    expect(sortStarted.offered).toEqual(sort.startState.offeredStack());
    expect(sortStarted.goalsDone).toEqual(sort.startState.goalsReached());
    expect(sortStarted.goalsNeeded).toEqual(sort.startState.goal());
    expect(sortPlayed.offered).toEqual(sort.after.offeredStack());
    expect(sortPlayed.goalsDone).toEqual(sort.after.goalsReached());
    expect(sortPlayed.goalsNeeded).toEqual(sort.after.goal());
    expect(sort.after.offeredStack()).not.toEqual(sort.startState.offeredStack());

    const merge = await startAndPlayOnce(mergeFactory());
    expect(mergeViewData(merge.started.payload).targetReached).toBe(
      merge.startState.hasReachedTarget(),
    );
    expect(mergeViewData(merge.played.payload).targetReached).toBe(merge.after.hasReachedTarget());
  });

  // Done when of issue #245: `MoveResult` keeps its fields and their values. The photo and
  // the view close their fields, and only the inside of `moveResultOf()` changes.
  // The expected answers are the answers of the code before #245, written out as values.
  // `freeSpaces` joins them since #170: the free spaces of the board, in the order of its shape.
  // A view keeps its fields private, so the test compares the data that the view delivers.
  it('should_keep_every_field_and_value_of_the_move_result_when_apply_move_plays_the_first_move_of_each_variant', async () => {
    const fields = [
      'canRedo',
      'canUndo',
      'cells',
      'freeSpaces',
      'hasUndo',
      'outcome',
      'payload',
      'score',
    ];
    const lines = (await startAndPlayOnce(linesFactory())).played;
    const fit = (await startAndPlayOnce(fitFactory())).played;
    const sort = (await startAndPlayOnce(sortFactory())).played;
    const merge = (await startAndPlayOnce(mergeFactory())).played;
    const single = new Piece(new CellNode(square(0, 0)), red);

    expect([lines, fit, sort, merge].map((result) => Object.keys(result).sort())).toEqual([
      fields,
      [...fields, 'elapsedMs'].sort(),
      fields,
      fields,
    ]);
    expect({ ...lines, payload: linesViewData(lines.payload) }).toEqual({
      cells: [[square(0, 0), red]],
      freeSpaces: [
        square(1, 0),
        square(2, 0),
        square(0, 1),
        square(1, 1),
        square(2, 1),
        square(0, 2),
        square(1, 2),
        square(2, 2),
      ],
      score: Score.of(1),
      outcome: Outcome.playing,
      canUndo: false,
      canRedo: false,
      hasUndo: false,
      payload: { tray: [single, single] },
    });
    expect({ ...fit, payload: fitViewData(fit.payload) }).toEqual({
      cells: [
        [square(0, 0), A],
        [square(1, 0), A],
      ],
      freeSpaces: [],
      score: Score.of(0),
      outcome: Outcome.victory,
      canUndo: false,
      canRedo: false,
      hasUndo: true,
      payload: { remaining: [], placed: [A] },
      elapsedMs: ElapsedTime.ofMs(0),
    });
    expect({ ...sort, payload: sortViewData(sort.payload) }).toEqual({
      cells: [[square(0, 0), stack('red')]],
      freeSpaces: [square(1, 0), square(0, 1), square(1, 1)],
      score: Score.of(0),
      outcome: Outcome.playing,
      canUndo: false,
      canRedo: false,
      hasUndo: false,
      payload: {
        offered: stackPiece(stack('blue')),
        goalsDone: ClearedStacks.of(0),
        goalsNeeded: GoalCount.of(5),
      },
    });
    expect({ ...merge, payload: mergeViewData(merge.payload) }).toEqual({
      cells: [
        [hex(1, 0), MergeTile.of(2)],
        [hex(0, 1), MergeTile.of(4)],
        [hex(1, -1), MergeTile.of(2)],
      ],
      freeSpaces: [hex(-1, 0), hex(-1, 1), hex(0, -1), hex(0, 0)],
      score: Score.of(0),
      outcome: Outcome.playing,
      canUndo: true,
      canRedo: false,
      hasUndo: true,
      payload: { targetReached: false },
    });
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
