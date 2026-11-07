/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger, UseCaseLogEntry } from '../../src/application/logger';
import { LoggingAspect } from '../../src/application/logging-aspect';
import { Result, UseCaseError } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { UseCaseAspect } from '../../src/application/use-case-aspect';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { square } from '../support/engine/square-topology';
import { firstValidMove } from '../support/engine/variant-game';
import { errorOf, gameUseCases, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';

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
  const { games, startGame, applyMove } = gameUseCases(factory);
  const start = logger ? new LoggingAspect(startGame, logger, 'StartGame') : startGame;
  const play = logger ? new LoggingAspect(applyMove, logger, 'ApplyMove') : applyMove;
  const started = await start.execute({});
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
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
      expect(run.started).toBe('playing');
    }
  });

  it('should_log_a_failure_entry_with_the_use_case_error_when_the_inner_use_case_fails', async () => {
    const logger = new RecordingLogger();
    const { applyMove } = gameUseCases(linesFactory());
    const aspect = new LoggingAspect(applyMove, logger, 'ApplyMove');

    const result = await aspect.execute({ move: new PlacePiece(0, square(0, 0)) });

    const error = errorOf(result);
    expect(error.code).toBe('no-running-game');
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toEqual({ useCase: 'ApplyMove', outcome: 'failure', error });
    expect(logger.entries[0].error).toBe(error);
  });

  it('should_return_the_inner_result_unchanged_and_pass_the_request_when_the_aspect_wraps_a_use_case', async () => {
    const success = new FixedUseCase(Result.success(7));
    const failure = new FixedUseCase(Result.failure(new UseCaseError('boom', 'It failed.', true)));
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

  it('should_pass_a_frozen_entry_with_no_message_and_no_time_when_the_aspect_logs_a_call', async () => {
    const logger = new RecordingLogger();
    const error = new UseCaseError('boom', 'It failed.');

    await new LoggingAspect(new FixedUseCase(Result.success(1)), logger, 'Fixed').execute('a');
    await new LoggingAspect(new FixedUseCase(Result.failure(error)), logger, 'Fixed').execute('b');

    expect(logger.entries.map((entry) => Object.keys(entry).sort())).toEqual([
      ['outcome', 'useCase'],
      ['error', 'outcome', 'useCase'],
    ]);
    expect(logger.entries.every((entry) => Object.isFrozen(entry))).toBe(true);
  });

  it('should_return_the_result_error_unchanged_when_the_logger_tries_to_change_its_entry', async () => {
    // The entry is frozen, but its error is the object of the `Result`.
    // `UseCaseError` is frozen too, so a logger cannot change what the caller gets.
    const logger = new ChangingLogger();
    const inner = new FixedUseCase(Result.failure(new UseCaseError('boom', 'It failed.')));

    const result = await new LoggingAspect(inner, logger, 'Fixed').execute('x');

    expect(result).toBe(inner.result);
    expect([errorOf(result).code, errorOf(result).message]).toEqual(['boom', 'It failed.']);
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
    // `ApplyMove` takes the `Logger` port only to report a publisher failure after the
    // engine saves the turn (issue 132). It holds no aspect and logs no call.
    const read = (file: string) =>
      readFileSync(join(__dirname, '../../src/application', file), 'utf8');
    for (const file of ['start-game.ts', 'apply-move.ts']) {
      expect(read(file)).not.toMatch(/\b(UseCaseAspect|LoggingAspect|Clock)\b/);
      expect(read(file)).not.toMatch(/from '\.\/(logging-aspect|use-case-aspect)'/);
    }
    expect(read('start-game.ts')).not.toMatch(/\b(Logger|UseCaseLogEntry)\b/);
    expect(read('start-game.ts')).not.toMatch(/from '\.\/logger'/);
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

  // The aspect's own work fails here: the logger throws after the inner call (G118.1).
  it('should_return_an_unexpected_failure_with_the_cause_when_the_logger_throws', async () => {
    const inner = new FixedUseCase(Result.success(5));

    const result = await new LoggingAspect(inner, new ThrowingLogger(), 'Fixed').execute('x');

    const error = errorOf(result);
    expect([error.code, error.message, error.retryable]).toEqual([
      'unexpected-failure',
      'The log disk is full.',
      false,
    ]);
    expect(error.cause).toEqual(new Error('The log disk is full.'));
    expect(inner.requests).toEqual(['x']);
  });

  it('should_return_the_inner_result_unchanged_when_the_plain_aspect_wraps_a_use_case', async () => {
    const success = new FixedUseCase(Result.success(7));
    const failure = new FixedUseCase(Result.failure(new UseCaseError('boom', 'It failed.', true)));

    expect(await new PassThroughAspect(success).execute('a')).toBe(success.result);
    expect(await new PassThroughAspect(failure).execute('b')).toBe(failure.result);
  });
});
