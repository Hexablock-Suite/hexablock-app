import type {
  AccountApi,
  CredentialsDto,
  CurrentUserDto,
  LoginDto,
  TokenDto,
} from '../../src/adapters/api/account-api';
import { ApiAccountGateway } from '../../src/adapters/api/api-account-gateway';
import { ApiDtoMapper } from '../../src/adapters/api/api-dto-mapper';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import { AccountFailure } from '../../src/application/account-gateway';
import type { Credentials } from '../../src/application/credentials';
import { FailureCode } from '../../src/application/result';
import { Session } from '../../src/application/session';

// #45 (APP-FR-12, decision 22): `ApiAccountGateway` signs the player up and in through the
// transport interface `AccountApi`, and `ApiDtoMapper` turns the DTOs into a `Session`.

const ADA: Credentials = { username: 'ada', password: 'correct horse battery' };
const TOKEN = 'token-of-ada';
const USER = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

type Answers = {
  signUp?: () => Promise<void>;
  signIn?: () => Promise<TokenDto>;
  currentUser?: () => Promise<CurrentUserDto>;
};

// A transport that records each call and gives the answer of the backend that accepts everything,
// or the answer of `answers`.
class FakeAccountApi implements AccountApi {
  readonly calls: string[] = [];

  constructor(private readonly answers: Answers = {}) {}

  signUp(body: CredentialsDto): Promise<void> {
    this.calls.push(`signUp ${JSON.stringify(body)}`);
    return this.answers.signUp?.() ?? Promise.resolve();
  }

  signIn(body: LoginDto): Promise<TokenDto> {
    this.calls.push(`signIn ${JSON.stringify(body)}`);
    return this.answers.signIn?.() ?? Promise.resolve({ accessToken: TOKEN });
  }

  currentUser(token: string): Promise<CurrentUserDto> {
    this.calls.push(`currentUser ${token}`);
    return this.answers.currentUser?.() ?? Promise.resolve({ userId: USER });
  }
}

const refusal = (status: number | undefined) => () =>
  Promise.reject(new ApiFailure(status, `The call answered ${status}.`));

// The error that `call` rejects with. A call that resolves fails the test.
async function errorOf(call: Promise<unknown>): Promise<unknown> {
  const thrown = await call.then(
    () => 'resolved',
    (error: unknown) => error,
  );
  if (thrown === 'resolved') throw new Error('The call did not reject.');
  return thrown;
}

const body = JSON.stringify(ADA);

describe('ApiAccountGateway', () => {
  it('should_sign_in_then_ask_for_the_user_of_the_token_when_the_player_signs_in', async () => {
    const api = new FakeAccountApi();

    const session = await new ApiAccountGateway(api, new ApiDtoMapper()).login(ADA);

    expect(session).toEqual(new Session(TOKEN, USER));
    expect(api.calls).toEqual([`signIn ${body}`, `currentUser ${TOKEN}`]);
  });

  it('should_sign_up_then_sign_in_when_the_player_signs_up', async () => {
    const api = new FakeAccountApi();

    const session = await new ApiAccountGateway(api, new ApiDtoMapper()).register(ADA);

    expect(session).toEqual(new Session(TOKEN, USER));
    expect(api.calls).toEqual([`signUp ${body}`, `signIn ${body}`, `currentUser ${TOKEN}`]);
  });

  it.each([
    ['register', { signUp: refusal(409) }, FailureCode.usernameTaken],
    ['register', { signUp: refusal(400) }, FailureCode.invalidCredentials],
    ['register', { signUp: refusal(undefined) }, FailureCode.backendUnreachable],
    ['login', { signIn: refusal(401) }, FailureCode.wrongCredentials],
    ['login', { signIn: refusal(undefined) }, FailureCode.backendUnreachable],
    ['login', { currentUser: refusal(undefined) }, FailureCode.backendUnreachable],
  ] as const)(
    'should_throw_the_account_failure_of_the_status_when_the_backend_refuses_the_call',
    async (operation, answers, code) => {
      const api = new FakeAccountApi(answers);

      const thrown = await errorOf(new ApiAccountGateway(api, new ApiDtoMapper())[operation](ADA));

      expect(thrown).toBeInstanceOf(AccountFailure);
      expect((thrown as AccountFailure).code).toBe(code);
      expect((thrown as AccountFailure).message).not.toContain(ADA.password);
    },
  );

  it.each([
    ['register', { signUp: refusal(401) }],
    ['register', { signUp: refusal(500) }],
    ['login', { signIn: refusal(400) }],
    ['login', { signIn: refusal(429) }],
    ['login', { currentUser: refusal(401) }],
  ] as const)(
    'should_throw_the_api_failure_as_it_is_when_the_status_names_no_account_failure',
    async (operation, answers) => {
      const thrown = await errorOf(
        new ApiAccountGateway(new FakeAccountApi(answers), new ApiDtoMapper())[operation](ADA),
      );

      expect(thrown).toBeInstanceOf(ApiFailure);
      expect(thrown).not.toBeInstanceOf(AccountFailure);
    },
  );

  it('should_not_sign_in_when_the_sign_up_fails', async () => {
    const api = new FakeAccountApi({ signUp: refusal(409) });

    await errorOf(new ApiAccountGateway(api, new ApiDtoMapper()).register(ADA));

    expect(api.calls).toEqual([`signUp ${body}`]);
  });
});

describe('ApiDtoMapper', () => {
  it('should_copy_the_username_and_the_password_when_it_builds_the_credentials_dto', () => {
    expect(new ApiDtoMapper().toCredentialsDto(ADA)).toEqual({
      username: 'ada',
      password: 'correct horse battery',
    });
  });

  it('should_build_the_session_of_the_token_and_the_user_when_it_reads_both_dtos', () => {
    expect(new ApiDtoMapper().toSession({ accessToken: TOKEN }, { userId: USER })).toEqual(
      new Session(TOKEN, USER),
    );
  });
});
