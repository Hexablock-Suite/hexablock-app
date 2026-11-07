// The error of a failed use case (classes.md decision 28). It is a value object.
// `code` names the failure for the presenter, `message` explains it,
// and `RetryAspect` runs the use case again while `retryable` is true.
// `cause` keeps the caught value, so the log still shows a programming error.
// An empty or blank `code` throws a `RangeError`, because the presenter reads it (G117.6).
export class UseCaseError {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly retryable = false,
    readonly cause?: unknown,
  ) {
    if (code.trim() === '') throw new RangeError('A use case error needs a code.');
    Object.freeze(this);
  }
}

// A value or an error, never both (classes.md decision 28). It is a value object.
// `ok` tells the two cases apart, so the compiler narrows `value` and `error`.
// A use case returns it and never throws to the presenter.
export type Result<T, E = UseCaseError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// The two creators of a `Result`. Each one returns a frozen object.
export const Result = {
  success<T, E = UseCaseError>(value: T): Result<T, E> {
    return Object.freeze({ ok: true, value });
  },
  failure<T, E = UseCaseError>(error: E): Result<T, E> {
    return Object.freeze({ ok: false, error });
  },
};

// The error of a caught exception as a `UseCaseError`. Any thrown value gives a message.
// The error keeps the thrown value as its `cause`.
export function caughtError(code: string, thrown: unknown): UseCaseError {
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  return new UseCaseError(code, message, false, thrown);
}
