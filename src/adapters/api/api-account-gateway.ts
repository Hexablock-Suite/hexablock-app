import {
  AccountFailure,
  type AccountFailureCode,
  type AccountGateway,
} from '../../application/ports/account-gateway';
import type { Credentials } from '../../application/ports/credentials';
import { FailureCode } from '../../application/result';
import type { Session } from '../../application/ports/session';
import type { AccountApi } from './account-api';
import type { ApiDtoMapper } from './api-dto-mapper';
import { ApiFailure } from './api-failure';

// The failure code of each status that the backend gives to a call (API-FR-01, hexablock-api
// `AuthController`). A sign-up answers 409 for a taken username and 400 for a username or a
// password that breaks its rule. A sign-in answers 401 for a wrong username or password.
type Refusals = ReadonlyMap<number, AccountFailureCode>;
const SIGN_UP: Refusals = new Map([
  [409, FailureCode.usernameTaken],
  [400, FailureCode.invalidCredentials],
]);
const SIGN_IN: Refusals = new Map([[401, FailureCode.wrongCredentials]]);
// A 401 just after a sign-in is no answer about the credentials, so it names no code.
const CURRENT_USER: Refusals = new Map();
// The message of a failed sign-in after a sign-up. It is fixed, so it holds no part of a body.
const SIGN_IN_AFTER_SIGN_UP = 'The sign-up created the account, but the sign-in after it failed.';

// Adapter of the `AccountGateway` port over hexablock-api (APP-FR-12, classes.md decisions 11
// and 22, flows.md use case 5). It lives in layer 3, `src/adapters/api/`, and calls the backend
// through the transport interface `AccountApi`, which `ApiClient` of layer 4 implements.
// `ApiDtoMapper` builds each body and the `Session`.
// A sign-in sends the credentials, then asks `GET /v1/auth/me` for the account of the token: the
// session keeps the user id for the local key of D27 (#46). That second request is the first
// request that sends the token. A sign-up creates the account, then signs it in.
// A known status throws the `AccountFailure` of its code, and a call with no answer throws the
// `AccountFailure` of `backend-unreachable`. Any other failure goes on as it is, and the use case
// gives its own code. One exception: any failure of the sign-in after a sign-up throws the
// `AccountFailure` of `sign-in-after-sign-up-failed`. The account exists then, so the player must
// sign in and not sign up again. The failure keeps the caught value as its `cause`.
export class ApiAccountGateway implements AccountGateway {
  constructor(
    private readonly api: AccountApi,
    private readonly mapper: ApiDtoMapper,
  ) {}

  async register(credentials: Credentials): Promise<Session> {
    await answerOf(() => this.api.signUp(this.mapper.toCredentialsDto(credentials)), SIGN_UP);
    try {
      return await this.login(credentials);
    } catch (thrown) {
      throw new AccountFailure(FailureCode.signInAfterSignUpFailed, SIGN_IN_AFTER_SIGN_UP, thrown);
    }
  }

  async login(credentials: Credentials): Promise<Session> {
    const token = await answerOf(
      () => this.api.signIn(this.mapper.toCredentialsDto(credentials)),
      SIGN_IN,
    );
    const user = await answerOf(() => this.api.currentUser(token.accessToken), CURRENT_USER);
    return this.mapper.toSession(token, user);
  }
}

// The answer of `call`. An `ApiFailure` with a status of `refusals` throws the `AccountFailure`
// of that code, and an `ApiFailure` with no status throws the one of `backend-unreachable`.
// The failure keeps the message of the `ApiFailure`, which names the call and its status only.
async function answerOf<T>(call: () => Promise<T>, refusals: Refusals): Promise<T> {
  try {
    return await call();
  } catch (thrown) {
    if (!(thrown instanceof ApiFailure)) throw thrown;
    const code =
      thrown.status === undefined ? FailureCode.backendUnreachable : refusals.get(thrown.status);
    if (code === undefined) throw thrown;
    throw new AccountFailure(code, thrown.message);
  }
}
