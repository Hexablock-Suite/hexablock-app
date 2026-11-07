/** @jest-environment node */
import { caughtError, Result, UseCaseError } from '../../src/application/result';

// `Result` holds a value or an error, never both (classes.md decision 28, issue 100).

describe('Result', () => {
  it('should_hold_the_value_and_no_error_when_result_success_creates_it', () => {
    const result = Result.success(42);

    expect(result).toEqual({ ok: true, value: 42 });
    expect('error' in result).toBe(false);
  });

  it('should_hold_the_error_and_no_value_when_result_failure_creates_it', () => {
    const error = new UseCaseError('move-rejected', 'The rules rejected the move.', true);
    const result = Result.failure<number>(error);

    expect(result).toEqual({ ok: false, error });
    expect('value' in result).toBe(false);
    expect([error.code, error.message, error.retryable]).toEqual([
      'move-rejected',
      'The rules rejected the move.',
      true,
    ]);
  });

  it('should_not_be_retryable_when_a_use_case_error_gets_no_retryable_flag', () => {
    expect(new UseCaseError('no-running-game', 'No game is running.').retryable).toBe(false);
  });

  it('should_give_the_text_of_the_thrown_value_when_caught_error_gets_a_value_that_is_not_an_error', () => {
    // Any thrown value gives a message: `String()` turns it into text.
    const thrown: unknown[] = ['The disk is full.', undefined, null, 42, { code: 7 }];

    expect(thrown.map((value) => caughtError('start-failed', value).message)).toEqual([
      'The disk is full.',
      'undefined',
      'null',
      '42',
      '[object Object]',
    ]);
    expect(caughtError('start-failed', undefined)).toEqual(
      new UseCaseError('start-failed', 'undefined', false),
    );
  });

  // The presenter picks its message by `code`, so an empty code helps no one (G117.6).
  it('should_throw_a_range_error_when_a_use_case_error_gets_an_empty_or_blank_code', () => {
    for (const code of ['', '  ', '\t']) {
      expect(() => new UseCaseError(code, 'It failed.')).toThrow(
        new RangeError('A use case error needs a code.'),
      );
    }
    expect(new UseCaseError(' boom ', 'It failed.').code).toBe(' boom ');
  });

  it('should_keep_the_thrown_value_as_the_cause_when_caught_error_builds_the_error', () => {
    const thrown = new TypeError('The adapter has a bug.');

    const error = caughtError('move-failed', thrown);

    expect([error.code, error.message, error.retryable]).toEqual([
      'move-failed',
      'The adapter has a bug.',
      false,
    ]);
    expect(error.cause).toBe(thrown);
    expect(new UseCaseError('boom', 'It failed.').cause).toBeUndefined();
  });

  it('should_reject_a_change_when_a_caller_writes_to_a_result', () => {
    const result = Result.success({ score: 1 });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(new UseCaseError('code', 'message'))).toBe(true);
  });
});
