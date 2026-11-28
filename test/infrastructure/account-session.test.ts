import { ApiAccountGateway } from '../../src/adapters/api/api-account-gateway';
import { ApiDtoMapper } from '../../src/adapters/api/api-dto-mapper';
import { SessionManager } from '../../src/adapters/session-manager';
import type { Credentials } from '../../src/application/ports/credentials';
import { Login } from '../../src/application/account/login';
import { Register } from '../../src/application/account/register';
import { FailureCode } from '../../src/application/result';
import { Session } from '../../src/application/ports/session';
import { createApiClient } from '../../src/infrastructure/api/client';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import type { FakeRoutes } from '../support/fake-backend';
import { fakeFetch, useFakeFetch, type FakeFetch } from '../support/fake-fetch';

// The Done-when line of #45 (APP-FR-12): «After sign-in, a sync request carries the token».
// The sync of #46 does not exist yet, so `GET /v1/auth/me` stands for it: the backend guards it
// with the token, as it guards the sync. The tests run the public use cases over the real gateway,
// the real HTTP client and the real session manager. A fake fetch answers as the backend does;
// the pact of test/contract/ checks the same requests against hexablock-api.

const ADA: Credentials = { username: 'ada', password: 'correct horse battery' };
const TOKEN = 'token-of-the-sign-in';
const USER = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const BACKEND = 'http://backend.test';

// A backend that signs ada in and answers `GET /v1/auth/me` only for the token of the sign-in.
const ADA_BACKEND: FakeRoutes = {
  '/v1/auth/register': { status: 201, body: {} },
  '/v1/auth/login': (request) =>
    JSON.parse(request.body).password === ADA.password
      ? { status: 200, body: { accessToken: TOKEN } }
      : { status: 401, body: { statusCode: 401 } },
  '/v1/auth/me': (request) =>
    request.headers.authorization === `Bearer ${TOKEN}`
      ? { status: 200, body: { userId: USER } }
      : { status: 401, body: { statusCode: 401 } },
};

describe('sign-in against the backend', () => {
  let backend: FakeFetch;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    backend = fakeFetch(ADA_BACKEND);
    spy = useFakeFetch(backend);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  const accounts = () => new ApiAccountGateway(createApiClient(BACKEND), new ApiDtoMapper());
  const calls = () => backend.requests.map(({ method, url }) => `${method} ${url}`);

  it('should_send_the_token_of_the_sign_in_when_the_app_asks_the_backend_for_the_signed_in_account', async () => {
    const secrets = new InMemorySecretStore();

    const result = await new Login(accounts(), new SessionManager(secrets)).execute(ADA);

    expect(result).toEqual({ ok: true, value: new Session(TOKEN, USER) });
    expect(calls()).toEqual(['POST /v1/auth/login', 'GET /v1/auth/me']);
    expect(JSON.parse(backend.requests[0]?.body ?? '')).toEqual(ADA);
    expect(backend.requests[1]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    // The app keeps the session for the next requests: a new manager reads it after a restart.
    await expect(new SessionManager(secrets).read()).resolves.toEqual(new Session(TOKEN, USER));
  });

  it('should_sign_the_new_account_in_and_send_its_token_when_the_player_signs_up', async () => {
    const secrets = new InMemorySecretStore();

    const result = await new Register(accounts(), new SessionManager(secrets)).execute(ADA);

    expect(result.ok).toBe(true);
    expect(calls()).toEqual(['POST /v1/auth/register', 'POST /v1/auth/login', 'GET /v1/auth/me']);
    expect(backend.requests[2]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    await expect(new SessionManager(secrets).read()).resolves.toEqual(new Session(TOKEN, USER));
  });

  it('should_keep_no_session_and_give_wrong_credentials_when_the_backend_refuses_the_password', async () => {
    const secrets = new InMemorySecretStore();

    const result = await new Login(accounts(), new SessionManager(secrets)).execute({
      username: 'ada',
      password: 'wrong horse battery',
    });

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.wrongCredentials);
    expect(calls()).toEqual(['POST /v1/auth/login']);
    await expect(new SessionManager(secrets).read()).resolves.toBeUndefined();
  });
});
