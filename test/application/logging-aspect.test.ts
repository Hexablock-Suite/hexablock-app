/** @jest-environment node */
import { Outcome } from '../../src/domain/engine/events/outcome';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameEventPublisher } from '../../src/application/ports/game-event-publisher';
import type { Logger, UseCaseLogEntry } from '../../src/application/aspects/logger';
import { LoggingAspect } from '../../src/application/aspects/logging-aspect';
import { Result, UseCaseError } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { UseCaseAspect } from '../../src/application/aspects/use-case-aspect';
import type { BoardState } from '../../src/domain/engine/board/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import type { GameEvent } from '../../src/domain/engine/events/game-events';
import type { IVariantFactory } from '../../src/domain/engine/factory/variant-factory';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { square } from '../support/engine/square-topology';
import { firstMoveOf } from '../support/engine/variant-game';
import { errorOf, gameUseCases, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import type { Clock } from '../../src/domain/engine/turn/clock';
import type { ClockReading } from '../../src/domain/engine/turn/clock-reading';
import { ManualClock } from '../support/engine/manual-clock';

// One `LoggingAspect` class wraps the generic use cases of the four variants (issue 101,
// APP-NFR-11, classes.md decisions 9 and 37, view 3.1).

// Starts one game and plays its first valid move, with or without the logging aspect.
async function startAndPlay<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>, logger?: RecordingLogger) {
  const { startGame, applyMove } = gameUseCases(factory);
  const start = logger ? new LoggingAspect(startGame, logger, 'StartGame') : startGame;
  const play = logger ? new LoggingAspect(applyMove, logger, 'ApplyMove') : applyMove;
  const started = await start.execute({});
  const move = firstMoveOf(factory);
  const played = await play.execute({ move });
  return { started, played };
}

// A use case that returns the same frozen `Result` on every call.
class FixedUseCase implements UseCase<string, number> {
  readonly requests: string[] = [];

  constructor(readonly result: Result<number>) {}

  async execute(request: string): Promise<Result<number>> {
    this.requests.push(request);
    return this.result;
  }
}

// A use case that moves the clock by `ms` milliseconds, then gives the answer of `answer()`.
// An answer that throws makes the use case reject, as a use case with a bug would.
class TimedUseCase implements UseCase<string, number> {
  constructor(
    private readonly clock: ManualClock,
    private readonly ms: number,
    private readonly answer: () => Result<number>,
  ) {}

  async execute(_request: string): Promise<Result<number>> {
    this.clock.advance(this.ms);
    return this.answer();
  }
}

// A clock that gives its first reading and throws on each later reading.
class FailingLaterClock implements Clock {
  private readonly clock = new ManualClock();
  private reads = 0;

  now(): ClockReading {
    this.reads += 1;
    if (this.reads > 1) throw new Error('The clock is gone.');
    return this.clock.now();
  }
}

// A publisher that fails on every event.
class ThrowingPublisher implements GameEventPublisher {
  publish(_event: GameEvent): void {
    throw new Error('The event bus is down.');
  }
}

// A logger that tries to change the entry and its error. It keeps the error of each write.
class ChangingLogger implements Logger {
  readonly writeErrors: unknown[] = [];

  log(entry: UseCaseLogEntry): void {
    this.tryWrite(() => Object.assign(entry, { useCase: 'Changed' }));
    this.tryWrite(() => Object.assign(entry.error ?? {}, { code: 'changed' }));
  }

  private tryWrite(write: () => void): void {
    try {
      write();
    } catch (error) {
      this.writeErrors.push(error);
    }
  }
}

// The log of one wrapped start and move, and whether the wrapped results equal the plain ones.
async function loggedRun<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: () => IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const logger = new RecordingLogger();
  const wrapped = await startAndPlay(factory(), logger);
  const plain = await startAndPlay(factory());
  return { entries: logger.entries, wrapped, plain, started: valueOf(wrapped.started).outcome };
}

describe('LoggingAspect', () => {
  it('should_log_one_success_entry_per_call_for_each_variant_when_one_aspect_class_wraps_the_use_cases', async () => {
    const runs = [
      await loggedRun(linesFactory),
      await loggedRun(fitFactory),
      await loggedRun(sortFactory),
      await loggedRun(mergeFactory),
    ];

    for (const run of runs) {
      expect(run.entries).toEqual([
        { useCase: 'StartGame', outcome: 'success' },
        { useCase: 'ApplyMove', outcome: 'success' },
      ]);
      expect(run.wrapped).toEqual(run.plain);
      expect(run.started).toBe(Outcome.playing);
    }
  });

  it('should_log_one_entry_for_each_undo_when_the_aspect_wraps_undo_move', async () => {
    const logger = new RecordingLogger();
    const factory = mergeFactory();
    const { startGame, applyMove, undoMove } = gameUseCases(factory);
    await startGame.execute({});
    const move = firstMoveOf(factory);
    await applyMove.execute({ move });
    const undo = new LoggingAspect(undoMove, logger, 'UndoMove');

    const undone = await undo.execute({});
    const refused = await undo.execute({});

    expect(valueOf(undone).canUndo).toBe(false);
    expect(errorOf(refused).code).toBe('nothing-to-undo');
    expect(logger.entries.map(({ useCase, outcome }) => [useCase, outcome])).toEqual([
      ['UndoMove', 'success'],
      ['UndoMove', 'failure'],
    ]);
  });

  // A publisher failure leaves the call a success (decision 29). The success carries the failed
  // delivery, so the one entry of the aspect carries it too (issue #342, decision 37).
  it('should_log_exactly_one_success_entry_that_carries_the_failed_delivery_when_apply_move_answers_with_a_failed_delivery', async () => {
    const logger = new RecordingLogger();
    const factory = fitFactory();
    const { startGame, applyMove } = gameUseCases(factory, new ThrowingPublisher());
    valueOf(await startGame.execute({}));
    const aspect = new LoggingAspect(applyMove, logger, 'ApplyMove');

    const played = valueOf(await aspect.execute({ move: firstMoveOf(factory) }));

    const failed = played.failedDeliveries ?? [];
    expect(failed.map((error) => error.code)).toEqual(['publish-failed']);
    expect(logger.entries).toEqual([
      { useCase: 'ApplyMove', outcome: 'success', failedDeliveries: failed },
    ]);
    expect(logger.entries[0].failedDeliveries?.[0]).toBe(failed[0]);
    expect(Object.isFrozen(logger.entries[0].failedDeliveries)).toBe(true);
  });

  it('should_log_a_failure_entry_with_the_use_case_error_when_the_inner_use_case_fails', async () => {
    const logger = new RecordingLogger();
    const { applyMove } = gameUseCases(linesFactory());
    const aspect = new LoggingAspect(applyMove, logger, 'ApplyMove');

    const result = await aspect.execute({ move: new PlacePiece(TrayPosition.of(0), square(0, 0)) });

    const error = errorOf(result);
    expect(error.code).toBe('no-running-game');
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toEqual({ useCase: 'ApplyMove', outcome: 'failure', error });
    expect(logger.entries[0].error).toBe(error);
  });

  it('should_return_the_inner_result_unchanged_and_pass_the_request_when_the_aspect_wraps_a_use_case', async () => {
    const success = new FixedUseCase(Result.success(7));
    const failure = new FixedUseCase(
      Result.failure(new UseCaseError('move-failed', 'It failed.', true)),
    );
    const logger = new RecordingLogger();

    const ok = await new LoggingAspect(success, logger, 'Fixed').execute('first');
    const failed = await new LoggingAspect(failure, logger, 'Fixed').execute('second');

    expect(ok).toBe(success.result);
    expect(failed).toBe(failure.result);
    expect([success.requests, failure.requests]).toEqual([['first'], ['second']]);
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['Fixed', 'success'],
      ['Fixed', 'failure'],
    ]);
  });

  // The entry holds data and the duration of the call, never a message (issue #343).
  it('should_pass_a_frozen_entry_with_its_time_and_no_message_when_the_aspect_logs_a_call', async () => {
    const logger = new RecordingLogger();
    const clock = new ManualClock();
    const error = new UseCaseError('move-failed', 'It failed.');

    await new LoggingAspect(new FixedUseCase(Result.success(1)), logger, 'Fixed', clock).execute(
      'a',
    );
    await new LoggingAspect(
      new FixedUseCase(Result.failure(error)),
      logger,
      'Fixed',
      clock,
    ).execute('b');

    expect(logger.entries.map((entry) => Object.keys(entry).sort())).toEqual([
      ['elapsedMs', 'outcome', 'useCase'],
      ['elapsedMs', 'error', 'outcome', 'useCase'],
    ]);
    expect(logger.entries.every((entry) => entry.elapsedMs instanceof ElapsedTime)).toBe(true);
    expect(logger.entries.every((entry) => Object.isFrozen(entry))).toBe(true);
  });

  // The aspect reads the clock before and after the inner call. The one entry of the call
  // carries the time between the two readings, for a success and for a failure (issue #343).
  it.each<['success' | 'failure', number, () => Result<number>]>([
    ['success', 25, () => Result.success(1)],
    ['failure', 40, () => Result.failure(new UseCaseError('move-failed', 'It failed.'))],
    [
      'failure',
      7,
      () => {
        throw new TypeError('The use case has a bug.');
      },
    ],
  ])(
    'should_put_the_duration_of_the_call_in_its_one_entry_when_the_aspect_reads_the_clock',
    async (outcome, ms, answer) => {
      const logger = new RecordingLogger();
      const clock = new ManualClock();

      const result = await new LoggingAspect(
        new TimedUseCase(clock, ms, answer),
        logger,
        'Timed',
        clock,
      ).execute('x');

      expect(logger.entries).toHaveLength(1);
      expect(logger.entries[0].outcome).toBe(outcome);
      expect(logger.entries[0].elapsedMs?.equals(ElapsedTime.ofMs(ms))).toBe(true);
      expect(logger.entries[0].error).toBe(result.ok ? undefined : result.error);
    },
  );

  it('should_return_the_result_error_unchanged_when_the_logger_tries_to_change_its_entry', async () => {
    // The entry is frozen, but its error is the object of the `Result`.
    // `UseCaseError` is frozen too, so a logger cannot change what the caller gets.
    const logger = new ChangingLogger();
    const inner = new FixedUseCase(Result.failure(new UseCaseError('move-failed', 'It failed.')));

    const result = await new LoggingAspect(inner, logger, 'Fixed').execute('x');

    expect(result).toBe(inner.result);
    expect([errorOf(result).code, errorOf(result).message]).toEqual(['move-failed', 'It failed.']);
    expect(logger.writeErrors).toHaveLength(2);
    expect(logger.writeErrors.every((error) => error instanceof TypeError)).toBe(true);
  });

  it('should_wrap_any_use_case_as_a_use_case_aspect_when_aspects_nest', async () => {
    const logger = new RecordingLogger();
    const inner = new FixedUseCase(Result.success(3));
    const nested = new LoggingAspect(new LoggingAspect(inner, logger, 'Inner'), logger, 'Outer');

    const result = await nested.execute('x');

    expect(nested).toBeInstanceOf(UseCaseAspect);
    expect(result).toBe(inner.result);
    expect(logger.entries.map((entry) => entry.useCase)).toEqual(['Inner', 'Outer']);
  });

  it('should_keep_aspect_code_out_of_the_use_cases_when_the_use_case_source_is_read', () => {
    // `ApplyMove` holds no aspect and logs no call. Its success carries a publisher failure,
    // and `LoggingAspect` writes it (issue #342).
    const read = (file: string) =>
      readFileSync(join(__dirname, '../../src/application/game', file), 'utf8');
    for (const file of ['start-game.ts', 'apply-move.ts']) {
      expect(read(file)).not.toMatch(/\b(UseCaseAspect|LoggingAspect|Clock)\b/);
      expect(read(file)).not.toMatch(/from '[^']*\/(logging-aspect|use-case-aspect)'/);
    }
    expect(read('start-game.ts')).not.toMatch(/\b(Logger|UseCaseLogEntry)\b/);
    expect(read('start-game.ts')).not.toMatch(/from '[^']*\/logger'/);
  });

  // `LoggingAspect` is the only writer of the log (issue #342, decision 37).
  it('should_find_no_logger_in_apply_move_when_its_source_is_read', () => {
    const source = readFileSync(
      join(__dirname, '../../src/application/game/apply-move.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/Logger|logEntryOf|from '[^']*\/logger'/);
  });

  // The log names the call by `name`, so an empty name helps no one (G118.4).
  it('should_throw_a_range_error_when_a_logging_aspect_gets_an_empty_or_blank_name', () => {
    const inner = new FixedUseCase(Result.success(1));
    const logger = new RecordingLogger();

    for (const name of ['', '  ', '\t']) {
      expect(() => new LoggingAspect(inner, logger, name)).toThrow(
        new RangeError('A logging aspect needs a name.'),
      );
    }
    expect(logger.entries).toEqual([]);
  });
});

// A use case that breaks its promise and rejects, as a use case with a bug would.
class RejectingUseCase implements UseCase<string, number> {
  constructor(private readonly thrown: unknown) {}

  async execute(_request: string): Promise<Result<number>> {
    throw this.thrown;
  }
}

// A logger whose adapter fails on every write.
class ThrowingLogger implements Logger {
  log(_entry: UseCaseLogEntry): void {
    throw new Error('The log disk is full.');
  }
}

// The plain Decorator: it adds no concern, so it shows what the base class does.
class PassThroughAspect<TRequest, TResponse> extends UseCaseAspect<TRequest, TResponse> {}

describe('UseCaseAspect', () => {
  // `execute()` never throws to the presenter (classes.md decision 28, G118.2).
  it('should_return_an_unexpected_failure_with_the_cause_when_the_inner_use_case_rejects', async () => {
    const thrown = new TypeError('The use case has a bug.');
    const logger = new RecordingLogger();

    const plain = await new PassThroughAspect(new RejectingUseCase(thrown)).execute('x');
    const logged = await new LoggingAspect(new RejectingUseCase(thrown), logger, 'Broken').execute(
      'x',
    );

    for (const result of [plain, logged]) {
      const error = errorOf(result);
      expect([error.code, error.message, error.retryable]).toEqual([
        'unexpected-failure',
        'The use case has a bug.',
        false,
      ]);
      expect(error.cause).toBe(thrown);
    }
    expect(logger.entries).toEqual([
      { useCase: 'Broken', outcome: 'failure', error: errorOf(logged) },
    ]);
  });

  // The log fails after the inner call, so the use case already did its work.
  // The aspect drops the failure of the logger and returns the inner result (issue #343).
  it.each<[Result<number>]>([
    [Result.success(5)],
    [Result.failure(new UseCaseError('move-failed', 'It failed.', true))],
  ])(
    'should_return_the_inner_result_unchanged_when_the_logger_throws_after_the_call',
    async (answer) => {
      const inner = new FixedUseCase(answer);

      const result = await new LoggingAspect(
        inner,
        new ThrowingLogger(),
        'Fixed',
        new ManualClock(),
      ).execute('x');

      expect(result).toBe(inner.result);
      expect(Object.keys(result).sort()).toEqual(Object.keys(answer).sort());
      expect(inner.requests).toEqual(['x']);
    },
  );

  // The clock is read after the inner call too, so a clock that fails there rewrites nothing.
  it('should_return_the_inner_result_unchanged_when_the_clock_throws_after_the_call', async () => {
    const logger = new RecordingLogger();
    const inner = new FixedUseCase(Result.success(5));

    const result = await new LoggingAspect(inner, logger, 'Fixed', new FailingLaterClock()).execute(
      'x',
    );

    expect(result).toBe(inner.result);
    expect(logger.entries).toEqual([]);
  });

  // An exception of the inner use case is a failure of the call, whatever the logger does.
  it('should_return_an_unexpected_failure_when_the_inner_use_case_rejects_and_the_logger_throws', async () => {
    const thrown = new TypeError('The use case has a bug.');

    const result = await new LoggingAspect(
      new RejectingUseCase(thrown),
      new ThrowingLogger(),
      'Broken',
      new ManualClock(),
    ).execute('x');

    const error = errorOf(result);
    expect([error.code, error.message, error.cause]).toEqual([
      'unexpected-failure',
      'The use case has a bug.',
      thrown,
    ]);
  });

  it('should_return_the_inner_result_unchanged_when_the_plain_aspect_wraps_a_use_case', async () => {
    const success = new FixedUseCase(Result.success(7));
    const failure = new FixedUseCase(
      Result.failure(new UseCaseError('move-failed', 'It failed.', true)),
    );

    expect(await new PassThroughAspect(success).execute('a')).toBe(success.result);
    expect(await new PassThroughAspect(failure).execute('b')).toBe(failure.result);
  });
});
