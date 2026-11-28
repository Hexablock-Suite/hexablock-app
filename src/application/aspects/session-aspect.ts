import type { SessionStore } from '../ports/session-store';
import { FailureCode, Result, UseCaseError } from '../result';
import type { UseCase } from '../use-case';
import { UseCaseAspect } from './use-case-aspect';

// What the inner use case needs from the session (#481).
// - `required`: a call with no session fails with `sign-in-required` and never reaches the use case.
// - `optional`: every call reaches the use case, which decides what no session means.
export type SessionNeed = 'required' | 'optional';

// The text of the failure of a call with no session.
const NO_SESSION = 'This use case needs a signed-in player.';

// Requires a session and clears a session that the backend refuses (#481, classes.md decision 69, view 3.1).
// The app does not authorize: the backend checks the token. This aspect only checks that a session exists.
// With `required`, it reads the session through `SessionStore` before the call.
// With no session it gives `sign-in-required`, and the inner use case and its backend do not run.
// A session that cannot be read lets the call through. Then the inner use case gives its own failure.
// With either need, a `session-expired` result clears the session through `SessionStore.clear()`.
// `clear()` keeps the owner of the progress (decision 66), so the screen asks the player to sign in.
// A clear that throws still gives `session-expired`. The backend refuses the token again at the next request.
// The inner use case also reads the session, because its gateway needs the token.
// So a call with `required` reads the session twice.
// `LoggingAspect` wraps this aspect, so the log keeps each call that the session rejects (APP-NFR-11).
export class SessionAspect<TRequest, TResponse> extends UseCaseAspect<TRequest, TResponse> {
  constructor(
    inner: UseCase<TRequest, TResponse>,
    private readonly sessions: SessionStore,
    private readonly need: SessionNeed,
  ) {
    super(inner);
  }

  protected override async around(request: TRequest): Promise<Result<TResponse>> {
    if (this.need === 'required' && (await this.hasNoSession())) {
      return Result.failure(new UseCaseError(FailureCode.signInRequired, NO_SESSION));
    }
    const result = await super.around(request);
    if (!result.ok && result.error.code === FailureCode.sessionExpired) await this.forgetSession();
    return result;
  }

  // True only when the store answers with no session. A read that throws gives false.
  private async hasNoSession(): Promise<boolean> {
    try {
      return (await this.sessions.read()) === undefined;
    } catch {
      return false;
    }
  }

  private async forgetSession(): Promise<void> {
    try {
      await this.sessions.clear();
    } catch {
      // The token stays. The backend refuses it again at the next request.
    }
  }
}
