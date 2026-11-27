import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { MatchersV3, PactV4 } from '@pact-foundation/pact';

import type { AccountApi } from '../../src/adapters/api/account-api';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import type { HealthApi } from '../../src/adapters/api/health-api';
import { createApiClient } from '../../src/infrastructure/api/client';
import { startFakeBackend, type FakeBackend, type FakeRoutes } from '../support/fake-backend';
import { repoRoot, runNodeScript } from '../support/run-tool';

const pactFile = path.join(repoRoot, 'pacts/hexablock-app-hexablock-api.json');

const pact = new PactV4({
  consumer: 'hexablock-app',
  provider: 'hexablock-api',
  dir: path.join(repoRoot, 'pacts'),
  logLevel: 'warn',
});

// The account of the interactions of #45. The provider states of hexablock-api #151 create it.
const ADA = { username: 'ada', password: 'correct horse battery' };
const WRONG_PASSWORD = { username: 'ada', password: 'wrong horse battery' };
const JSON_HEADERS = { 'Content-Type': 'application/json' };
// The example token and user id of the mock server. Against the provider, the verifier sends the
// token that the provider state `a signed-in account exists` gives.
const EXAMPLE_TOKEN = 'a-token';
const EXAMPLE_USER = '00000000-0000-4000-8000-000000000001';

// The interactions of the pact, in the order of the consumer tests below.
const DESCRIPTIONS = [
  'a health check',
  'a sign-up with a free username',
  'a sign-up with a taken username',
  'a sign-in',
  'a sign-in with a wrong password',
  'the signed-in user',
];

// The `ApiFailure` that `call` rejects with. A call that resolves fails the test.
async function failureOf(call: Promise<unknown>): Promise<ApiFailure> {
  const thrown = await call.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(thrown instanceof ApiFailure))
    throw new Error('The call did not reject with an ApiFailure.');
  return thrown;
}

// Jest runs the tests of one file in order. The consumer tests write the pact file first.
// The provider checks below then read it, so no other test file races the write.
describe('client contract', () => {
  describe('consumer', () => {
    // Pact merges new interactions into an existing file and never drops old ones.
    // Removing the file first makes each run write exactly the interactions below.
    // Keep every hexablock-api interaction in this file, or a later file would drop them.
    beforeAll(() => {
      rmSync(pactFile, { force: true });
    });

    it('should_return_status_ok_when_backend_health_answers_200', async () => {
      await pact
        .addInteraction()
        .uponReceiving('a health check')
        .withRequest('GET', '/v1/health')
        .willRespondWith(200, (builder) => builder.jsonBody({ status: 'ok' }))
        .executeTest(async (mockServer) => {
          // The client of layer 4 implements the transport interface of layer 3 (decision 22).
          const api: HealthApi = createApiClient(mockServer.url);
          const health = await api.getHealth();

          expect(health).toEqual({ status: 'ok' });
        });

      const written = JSON.parse(readFileSync(pactFile, 'utf8'));
      expect(written.consumer.name).toBe('hexablock-app');
      expect(written.provider.name).toBe('hexablock-api');
      expect(written.interactions).toHaveLength(1);
    });

    // #45: the app signs up a player with the name and the password of the form.
    it('should_resolve_with_no_value_when_the_backend_creates_the_account', async () => {
      await pact
        .addInteraction()
        .given('no account exists')
        .uponReceiving('a sign-up with a free username')
        .withRequest('POST', '/v1/auth/register', (builder) =>
          builder.headers(JSON_HEADERS).jsonBody(ADA),
        )
        .willRespondWith(201)
        .executeTest(async (mockServer) => {
          const api: AccountApi = createApiClient(mockServer.url);

          await expect(api.signUp(ADA)).resolves.toBeUndefined();
        });
    });

    it('should_reject_with_the_status_409_when_another_account_has_the_username', async () => {
      await pact
        .addInteraction()
        .given('an account exists', ADA)
        .uponReceiving('a sign-up with a taken username')
        .withRequest('POST', '/v1/auth/register', (builder) =>
          builder.headers(JSON_HEADERS).jsonBody(ADA),
        )
        .willRespondWith(409)
        .executeTest(async (mockServer) => {
          const api: AccountApi = createApiClient(mockServer.url);

          const failure = await failureOf(api.signUp(ADA));

          expect(failure.status).toBe(409);
          expect(failure.message).not.toContain(ADA.password);
        });
    });

    it('should_give_the_bearer_token_when_the_backend_accepts_the_credentials', async () => {
      await pact
        .addInteraction()
        .given('an account exists', ADA)
        .uponReceiving('a sign-in')
        .withRequest('POST', '/v1/auth/login', (builder) =>
          builder.headers(JSON_HEADERS).jsonBody(ADA),
        )
        .willRespondWith(200, (builder) =>
          builder.jsonBody({ accessToken: MatchersV3.string(EXAMPLE_TOKEN) }),
        )
        .executeTest(async (mockServer) => {
          const api: AccountApi = createApiClient(mockServer.url);

          await expect(api.signIn(ADA)).resolves.toEqual({ accessToken: EXAMPLE_TOKEN });
        });
    });

    it('should_reject_with_the_status_401_when_the_password_is_wrong', async () => {
      await pact
        .addInteraction()
        .given('an account exists', ADA)
        .uponReceiving('a sign-in with a wrong password')
        .withRequest('POST', '/v1/auth/login', (builder) =>
          builder.headers(JSON_HEADERS).jsonBody(WRONG_PASSWORD),
        )
        .willRespondWith(401)
        .executeTest(async (mockServer) => {
          const api: AccountApi = createApiClient(mockServer.url);

          const failure = await failureOf(api.signIn(WRONG_PASSWORD));

          expect(failure.status).toBe(401);
          expect(failure.message).not.toContain(WRONG_PASSWORD.password);
        });
    });

    // The Done-when line of #45: after sign-in, a request sends the token.
    it('should_send_the_bearer_token_and_give_the_user_id_when_the_app_asks_for_the_signed_in_user', async () => {
      await pact
        .addInteraction()
        .given('a signed-in account exists', { username: ADA.username })
        .uponReceiving('the signed-in user')
        .withRequest('GET', '/v1/auth/me', (builder) =>
          builder.headers({
            Authorization: MatchersV3.fromProviderState(
              'Bearer ${accessToken}',
              `Bearer ${EXAMPLE_TOKEN}`,
            ),
          }),
        )
        .willRespondWith(200, (builder) =>
          builder.jsonBody({ userId: MatchersV3.uuid(EXAMPLE_USER) }),
        )
        .executeTest(async (mockServer) => {
          const api: AccountApi = createApiClient(mockServer.url);

          await expect(api.currentUser(EXAMPLE_TOKEN)).resolves.toEqual({ userId: EXAMPLE_USER });
        });

      const written = JSON.parse(readFileSync(pactFile, 'utf8'));
      expect(
        written.interactions.map(({ description }: { description: string }) => description).sort(),
      ).toEqual([...DESCRIPTIONS].sort());
    });
  });

  describe('provider check script (pnpm contract:verify)', () => {
    // The token that the fake provider gives for the state `a signed-in account exists`.
    const STATE_TOKEN = 'token-of-the-provider-state';
    let backend: FakeBackend | undefined;

    afterEach(async () => {
      await backend?.close();
      backend = undefined;
    });

    // A fake provider that honors every interaction of the pact (hexablock-api #151).
    // It keeps the provider state that the verifier set up before the current interaction,
    // and it gives the token of the state `a signed-in account exists`.
    function fakeProvider(health: unknown = { status: 'ok' }): FakeRoutes {
      let state = '';
      return {
        '/v1/_pact/provider-states': (request) => {
          const change = JSON.parse(request.body || '{}') as { state?: string; action?: string };
          state = change.action === 'setup' ? (change.state ?? '') : '';
          const signedIn = state === 'a signed-in account exists';
          return { status: 200, body: signedIn ? { accessToken: STATE_TOKEN } : {} };
        },
        '/v1/health': { status: 200, body: health },
        '/v1/auth/register': () =>
          state === 'an account exists'
            ? { status: 409, body: { statusCode: 409 } }
            : { status: 201, body: {} },
        '/v1/auth/login': (request) =>
          JSON.parse(request.body).password === ADA.password
            ? { status: 200, body: { accessToken: 'token-of-the-sign-in' } }
            : { status: 401, body: { statusCode: 401 } },
        '/v1/auth/me': (request) =>
          request.headers.authorization === `Bearer ${STATE_TOKEN}`
            ? { status: 200, body: { userId: EXAMPLE_USER } }
            : { status: 401, body: { statusCode: 401 } },
      };
    }

    const contractVerify = (url: string) =>
      runNodeScript('scripts/contract/verify-provider.mjs', [], { BACKEND_URL: url });

    it('should_pass_contract_verify_when_backend_honors_the_pact', async () => {
      backend = await startFakeBackend(fakeProvider());

      const result = await contractVerify(backend.url);

      expect(result.output).not.toContain('Pact verification failed');
      expect(result.status).toBe(0);
    });

    // hexablock-api #151: the verifier sets up the provider state of each interaction through
    // the state-change endpoint, and it sends the token that the state gives.
    it('should_set_up_each_provider_state_and_send_its_token_when_contract_verify_runs', async () => {
      backend = await startFakeBackend(fakeProvider());

      const result = await contractVerify(backend.url);
      const requests = backend.requests;
      const setUp = requests
        .filter(({ url }) => url === '/v1/_pact/provider-states')
        .map(({ body }) => JSON.parse(body) as { state?: string; action?: string })
        .filter(({ action }) => action === 'setup')
        .map(({ state }) => state)
        .filter((state) => state !== undefined && state !== '');
      const me = requests.find(({ url }) => url === '/v1/auth/me');

      expect(result.status).toBe(0);
      expect(new Set(setUp)).toEqual(
        new Set(['no account exists', 'an account exists', 'a signed-in account exists']),
      );
      expect(me?.headers.authorization).toBe(`Bearer ${STATE_TOKEN}`);
    });

    it('should_fail_contract_verify_when_backend_breaks_the_health_body', async () => {
      backend = await startFakeBackend(fakeProvider({ status: 'down' }));

      const result = await contractVerify(backend.url);

      expect(result.status).not.toBe(0);
      expect(result.output).toContain('a health check');
    });
  });
});
