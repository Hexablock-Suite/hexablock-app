import { keptSession, type AccountGateway } from '../ports/account-gateway';
import type { AnonymousMerge } from '../ports/anonymous-progress';
import type { Credentials } from '../ports/credentials';
import { FailureCode, type Result } from '../result';
import type { Session } from '../ports/session';
import type { SessionStore } from '../ports/session-store';
import type { UseCase } from '../use-case';

// Signs the player in (APP-FR-12, docs/architecture/flows.md use case 5, view 3.4).
// It asks the `AccountGateway` port for the session of the credentials and keeps it through
// the `SessionStore` port, so the next requests send its token (D27). With `merge`, it then
// merges the progress played with no account into the progress of the user (#46).
// A refused sign-in gives the code of the `AccountFailure` of the gateway, such as
// `wrong-credentials`, and keeps the session that the store held. Any other failure gives
// `login-failed`. No exception leaves `execute()` (decision 28).
export class Login implements UseCase<Credentials, Session> {
  constructor(
    private readonly accounts: AccountGateway,
    private readonly session: SessionStore,
    private readonly merge?: AnonymousMerge,
  ) {}

  execute(request: Credentials): Promise<Result<Session>> {
    return keptSession(
      () => this.accounts.login(request),
      this.session,
      FailureCode.loginFailed,
      this.merge,
    );
  }
}
