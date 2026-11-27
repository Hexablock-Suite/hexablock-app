// The code of each failure of a use case (classes.md decision 62, issue #322).
// It is the one list of codes. A use case builds each error from it and never writes
// the text of a code. A presenter maps the codes with a `Record<FailureCode, TextKey>`.
// So a new code goes into this list, and the type check then asks every presenter for its text.
// The type has the name of the list, so `FailureCode.moveRejected` gives one code.
export const FailureCode = Object.freeze({
  startFailed: 'start-failed',
  noRunningGame: 'no-running-game',
  moveRejected: 'move-rejected',
  moveFailed: 'move-failed',
  publishFailed: 'publish-failed',
  noUndo: 'no-undo',
  nothingToUndo: 'nothing-to-undo',
  undoFailed: 'undo-failed',
  nothingToRedo: 'nothing-to-redo',
  redoFailed: 'redo-failed',
  saveFailed: 'save-failed',
  loadFailed: 'load-failed',
  listFailed: 'list-failed',
  levelLocked: 'level-locked',
  unexpectedFailure: 'unexpected-failure',
} as const);

export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];

// The error of a failed use case (classes.md decision 28). It is a value object.
// `code` names the failure for the presenter, and `message` explains it.
// `retryable` has no reader yet. It stays only if issue #46 needs a retry of the sync.
// `cause` keeps the caught value, so the log still shows a programming error.
// An empty or blank `code` throws a `RangeError`, because the presenter reads it (G117.6).
export class UseCaseError {
  constructor(
    readonly code: FailureCode,
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

// The message of a thrown value whose text cannot be built (issue #138).
const NO_TEXT = 'The thrown value has no text.';

// The error of a caught exception as a `UseCaseError`. Any thrown value gives a message.
// The error keeps the thrown value as its `cause`.
// `String()` throws for a value without a prototype or with a `toString` that throws.
// Then the message is fixed, so this function never throws for any thrown value (issue #138).
export function caughtError(code: FailureCode, thrown: unknown): UseCaseError {
  return new UseCaseError(code, textOf(thrown), false, thrown);
}

function textOf(thrown: unknown): string {
  try {
    return thrown instanceof Error ? thrown.message : String(thrown);
  } catch {
    return NO_TEXT;
  }
}
