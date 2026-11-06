/** @jest-environment node */
import { Result, UseCaseError } from '../../src/application/result';

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

  it('should_reject_a_change_when_a_caller_writes_to_a_result', () => {
    const result = Result.success({ score: 1 });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(new UseCaseError('code', 'message'))).toBe(true);
  });
});
