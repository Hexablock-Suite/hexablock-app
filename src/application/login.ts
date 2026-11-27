import { keptSession, type AccountGateway } from './account-gateway';
import type { Credentials } from './credentials';
import { FailureCode, type Result } from './result';
import type { Session } from './session';
import type { SessionStore } from './session-store';
import type { UseCase } from './use-case';

// Signs the player in (APP-FR-12, docs/architecture/flows.md use case 5, view 3.4).
// It asks the `AccountGateway` port for the session of the credentials and keeps it through
// the `SessionStore` port, so the next requests send its token (D27). It touches no entity.
// A refused sign-in gives the code of the `AccountFailure` of the gateway, such as
// `wrong-credentials`, and keeps the session that the store held. Any other failure gives
// `login-failed`. No exception leaves `execute()` (decision 28).
export class Login implements UseCase<Credentials, Session> {
  constructor(
    private readonly accounts: AccountGateway,
    private readonly session: SessionStore,
  ) {}

  execute(request: Credentials): Promise<Result<Session>> {
    return keptSession(() => this.accounts.login(request), this.session, FailureCode.loginFailed);
  }
}
