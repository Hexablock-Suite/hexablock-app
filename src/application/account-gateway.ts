import type { Credentials } from './credentials';
import { caughtError, FailureCode, Result, UseCaseError } from './result';
import type { Session } from './session';
import type { SessionStore } from './session-store';

// The failure codes of a sign-up or a sign-in that the backend gives, or that its silence gives.
// `sign-in-after-sign-up-failed` names a sign-up that creates the account and a sign-in after it
// that fails. Then the account exists, and the player signs in.
export type AccountFailureCode =
  | typeof FailureCode.usernameTaken
  | typeof FailureCode.wrongCredentials
  | typeof FailureCode.invalidCredentials
  | typeof FailureCode.backendUnreachable
  | typeof FailureCode.signInAfterSignUpFailed;

// The error that an `AccountGateway` throws for a known failure (APP-FR-12): the backend refuses
// the request, or it gives no answer. `code` is the failure code of the use case.
// Any other thrown value is a failure of the gateway itself.
// `cause` keeps the caught value of a failure that the gateway names, so the log still shows it.
export class AccountFailure extends Error {
  constructor(
    readonly code: AccountFailureCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AccountFailure';
  }
}

// Output port of the account (APP-FR-12, classes.md decision 11, view 3.4). `Register` and
// `Login` call the backend through it. `ApiAccountGateway` of layer 3, `src/adapters/api/`,
// implements it (decision 22). Each operation gives the session of the account.
// A known failure throws an `AccountFailure`.
export interface AccountGateway {
  // Creates the account and signs it in. A failed sign-in after the sign-up throws the
  // `AccountFailure` of `sign-in-after-sign-up-failed`, because the account exists.
  register(credentials: Credentials): Promise<Session>;
  // Signs the account in.
  login(credentials: Credentials): Promise<Session>;
}

// The answer of `Register` and `Login` (APP-FR-12, view 3.4). `ask` asks the gateway for the
// session, and `session` keeps it. An `AccountFailure` gives its own code. Any other thrown value,
// from the gateway or from the store, gives `failed`, the code of the use case.
// A failure of the gateway keeps no session. No exception leaves this function (decision 28).
export async function keptSession(
  ask: () => Promise<Session>,
  session: SessionStore,
  failed: FailureCode,
): Promise<Result<Session>> {
  try {
    const signedIn = await ask();
    await session.write(signedIn);
    return Result.success(signedIn);
  } catch (thrown) {
    if (thrown instanceof AccountFailure) {
      return Result.failure(new UseCaseError(thrown.code, thrown.message, false, thrown));
    }
    return Result.failure(caughtError(failed, thrown));
  }
}
