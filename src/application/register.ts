import { keptSession, type AccountGateway } from './account-gateway';
import type { AnonymousMerge } from './anonymous-progress';
import type { Credentials } from './credentials';
import { FailureCode, type Result } from './result';
import type { Session } from './session';
import type { SessionStore } from './session-store';
import type { UseCase } from './use-case';

// Signs the player up (APP-FR-12, view 3.4). It follows the path of `Login` (flows.md use case 5):
// it asks the `AccountGateway` port to create the account and to sign it in, and it keeps the
// session through the `SessionStore` port. With `merge`, it then merges the progress played with no
// account into the progress of the user (#46).
// A refused sign-up gives the code of the `AccountFailure` of the gateway, such as
// `username-taken`, and keeps the session that the store held. Any other failure gives
// `register-failed`. No exception leaves `execute()` (decision 28).
export class Register implements UseCase<Credentials, Session> {
  constructor(
    private readonly accounts: AccountGateway,
    private readonly session: SessionStore,
    private readonly merge?: AnonymousMerge,
  ) {}

  execute(request: Credentials): Promise<Result<Session>> {
    return keptSession(
      () => this.accounts.register(request),
      this.session,
      FailureCode.registerFailed,
      this.merge,
    );
  }
}
