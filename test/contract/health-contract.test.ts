import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { MatchersV3, PactV4 } from '@pact-foundation/pact';

import type { AccountApi } from '../../src/adapters/api/account-api';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import type { HealthApi } from '../../src/adapters/api/health-api';
import type { LeaderboardApi } from '../../src/adapters/api/leaderboard-api';
import type { LevelsApi } from '../../src/adapters/api/levels-api';
import type { ProgressApi } from '../../src/adapters/api/progress-api';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
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
// A password shorter than the 8 characters that hexablock-api asks for. The API answers 400 for a
// field that breaks its rule (`POST /v1/auth/register` in `schema.d.ts`).
const SHORT_PASSWORD = { username: 'ada', password: 'short' };
const JSON_HEADERS = { 'Content-Type': 'application/json' };
// The example token and user id of the mock server. Against the provider, the verifier sends the
// token that the provider state `a signed-in account exists` gives.
const EXAMPLE_TOKEN = 'a-token';
const EXAMPLE_USER = '00000000-0000-4000-8000-000000000001';
// #46: the sync of one result of a stored level. The provider state `a level is stored` stores the
// example level of the level format, which has three star thresholds.
const SYNCED_LEVEL = { gameId: 'hexa-fit', levelId: 'fit-01' };
const SYNC_BODY = {
  gameId: 'hexa-fit',
  results: [{ levelId: 'fit-01', stars: 3, moves: 10, elapsedMs: 45000 }],
};
const EXAMPLE_UPDATED_AT = '2026-11-27T10:00:00.000Z';
// A token that the backend refuses: it is not a signed token of the API.
const REFUSED_TOKEN = 'a-refused-token';
// #47: the boards of a stored level with results. The provider state `several accounts have results
// on a stored level` stores the level, syncs one result of ada, grace and linus and gives the token of
// ada. A level that no provider state stores has no board.
const BOARD_LEVEL = { gameId: 'hexa-fit', levelId: 'fit-01' };
const UNKNOWN_LEVEL = 'fit-99';
const RESULTS_STATE = 'several accounts have results on a stored level';
const EXAMPLE_ENTRY = {
  rank: MatchersV3.integer(1),
  userId: MatchersV3.uuid(EXAMPLE_USER),
  username: MatchersV3.string('ada'),
};

// The interactions of the pact, in the order of the consumer tests below.
const DESCRIPTIONS = [
  'a health check',
  'a sign-up with a free username',
  'a sign-up with a taken username',
  'a sign-up with an invalid body',
  'a sign-in',
  'a sign-in with a wrong password',
  'the signed-in user',
  'a progress sync',
  'a progress sync with a refused token',
  'the global leaderboard of a game',
  'the leaderboard of a level',
  'a leaderboard with a refused token',
  'the leaderboard of a level that is not stored',
  'the stored levels',
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

    // The gateway maps this 400 to `invalid-credentials`.
    it('should_reject_with_the_status_400_when_the_password_breaks_the_rule_of_the_api', async () => {
      await pact
        .addInteraction()
        .given('no account exists')
        .uponReceiving('a sign-up with an invalid body')
        .withRequest('POST', '/v1/auth/register', (builder) =>
          builder.headers(JSON_HEADERS).jsonBody(SHORT_PASSWORD),
        )
        .willRespondWith(400)
        .executeTest(async (mockServer) => {
          const api: AccountApi = createApiClient(mockServer.url);

          const failure = await failureOf(api.signUp(SHORT_PASSWORD));

          expect(failure.status).toBe(400);
          expect(failure.message).not.toContain(SHORT_PASSWORD.password);
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
    });

    // #46 (APP-FR-13): the app sends the local progress of one game with the token of the session,
    // and the backend answers with the progress entry of the user and the game after the sync.
    it('should_send_the_token_and_the_progress_and_give_the_entry_when_the_app_syncs_the_progress', async () => {
      await pact
        .addInteraction()
        .given('a signed-in account exists', { username: ADA.username })
        .given('a level is stored', SYNCED_LEVEL)
        .uponReceiving('a progress sync')
        .withRequest('POST', '/v1/progress', (builder) =>
          builder
            .headers({
              ...JSON_HEADERS,
              Authorization: MatchersV3.fromProviderState(
                'Bearer ${accessToken}',
                `Bearer ${EXAMPLE_TOKEN}`,
              ),
            })
            .jsonBody(SYNC_BODY),
        )
        .willRespondWith(200, (builder) =>
          builder.jsonBody({
            gameId: 'hexa-fit',
            highScore: null,
            updatedAt: MatchersV3.regex(
              '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$',
              EXAMPLE_UPDATED_AT,
            ),
            results: MatchersV3.eachLike({
              levelId: MatchersV3.string('fit-01'),
              stars: MatchersV3.integer(3),
              moves: MatchersV3.integer(10),
              elapsedMs: MatchersV3.integer(45000),
            }),
          }),
        )
        .executeTest(async (mockServer) => {
          const api: ProgressApi = createApiClient(mockServer.url);

          await expect(api.syncProgress(EXAMPLE_TOKEN, SYNC_BODY)).resolves.toEqual({
            ...SYNC_BODY,
            highScore: null,
            updatedAt: EXAMPLE_UPDATED_AT,
          });
        });
    });

    // The token lives 24 hours and has no refresh. The gateway maps this 401 to `session-expired`.
    it('should_reject_with_the_status_401_when_the_backend_refuses_the_token_of_the_sync', async () => {
      await pact
        .addInteraction()
        .uponReceiving('a progress sync with a refused token')
        .withRequest('POST', '/v1/progress', (builder) =>
          builder
            .headers({ ...JSON_HEADERS, Authorization: `Bearer ${REFUSED_TOKEN}` })
            .jsonBody(SYNC_BODY),
        )
        .willRespondWith(401)
        .executeTest(async (mockServer) => {
          const api: ProgressApi = createApiClient(mockServer.url);

          const failure = await failureOf(api.syncProgress(REFUSED_TOKEN, SYNC_BODY));

          expect(failure.status).toBe(401);
          expect(failure.message).not.toContain(REFUSED_TOKEN);
        });
    });

    // #47 (APP-FR-14): the global board of Fit ranks the totals of the level results (S3-03).
    it('should_send_the_token_and_give_the_standings_when_the_app_reads_the_global_leaderboard', async () => {
      await pact
        .addInteraction()
        .given(RESULTS_STATE, BOARD_LEVEL)
        .uponReceiving('the global leaderboard of a game')
        .withRequest('GET', '/v1/leaderboard/hexa-fit', (builder) =>
          builder.headers({
            Authorization: MatchersV3.fromProviderState(
              'Bearer ${accessToken}',
              `Bearer ${EXAMPLE_TOKEN}`,
            ),
          }),
        )
        .willRespondWith(200, (builder) =>
          builder.jsonBody({
            gameId: 'hexa-fit',
            highScores: [],
            standings: MatchersV3.eachLike({
              ...EXAMPLE_ENTRY,
              stars: MatchersV3.integer(3),
              levelsCompleted: MatchersV3.integer(1),
              moves: MatchersV3.integer(10),
              elapsedMs: MatchersV3.integer(45000),
            }),
          }),
        )
        .executeTest(async (mockServer) => {
          const api: LeaderboardApi = createApiClient(mockServer.url);

          await expect(api.globalLeaderboard(EXAMPLE_TOKEN, 'hexa-fit')).resolves.toEqual({
            gameId: 'hexa-fit',
            highScores: [],
            standings: [
              {
                rank: 1,
                userId: EXAMPLE_USER,
                username: 'ada',
                stars: 3,
                levelsCompleted: 1,
                moves: 10,
                elapsedMs: 45000,
              },
            ],
          });
        });
    });

    // #47 (APP-FR-14): the board of one level ranks the best result of each player (DS-4).
    it('should_send_the_token_and_give_the_entries_when_the_app_reads_the_leaderboard_of_a_level', async () => {
      await pact
        .addInteraction()
        .given(RESULTS_STATE, BOARD_LEVEL)
        .uponReceiving('the leaderboard of a level')
        .withRequest('GET', '/v1/leaderboard/hexa-fit/levels/fit-01', (builder) =>
          builder.headers({
            Authorization: MatchersV3.fromProviderState(
              'Bearer ${accessToken}',
              `Bearer ${EXAMPLE_TOKEN}`,
            ),
          }),
        )
        .willRespondWith(200, (builder) =>
          builder.jsonBody({
            gameId: 'hexa-fit',
            levelId: 'fit-01',
            entries: MatchersV3.eachLike({
              ...EXAMPLE_ENTRY,
              stars: MatchersV3.integer(3),
              moves: MatchersV3.integer(10),
              elapsedMs: MatchersV3.integer(45000),
            }),
          }),
        )
        .executeTest(async (mockServer) => {
          const api: LeaderboardApi = createApiClient(mockServer.url);

          await expect(api.levelLeaderboard(EXAMPLE_TOKEN, 'hexa-fit', 'fit-01')).resolves.toEqual({
            gameId: 'hexa-fit',
            levelId: 'fit-01',
            entries: [
              {
                rank: 1,
                userId: EXAMPLE_USER,
                username: 'ada',
                stars: 3,
                moves: 10,
                elapsedMs: 45000,
              },
            ],
          });
        });
    });

    // The gateway maps this 401 to `session-expired`.
    it('should_reject_with_the_status_401_when_the_backend_refuses_the_token_of_a_leaderboard', async () => {
      await pact
        .addInteraction()
        .uponReceiving('a leaderboard with a refused token')
        .withRequest('GET', '/v1/leaderboard/hexa-fit', (builder) =>
          builder.headers({ Authorization: `Bearer ${REFUSED_TOKEN}` }),
        )
        .willRespondWith(401)
        .executeTest(async (mockServer) => {
          const api: LeaderboardApi = createApiClient(mockServer.url);

          const failure = await failureOf(api.globalLeaderboard(REFUSED_TOKEN, 'hexa-fit'));

          expect(failure.status).toBe(401);
          expect(failure.message).not.toContain(REFUSED_TOKEN);
        });
    });

    // #48 (APP-FR-15): the app reads the stored levels of the backend, with no token. The provider
    // state `a level is stored` of hexablock-api #151 stores the example level of the level format,
    // which the bundled file `fit-01.json` holds too. The pact pins the shape of each level, so a
    // level that the backend stores later still matches.
    it('should_give_the_stored_levels_when_the_backend_holds_a_level', async () => {
      await pact
        .addInteraction()
        .given('a level is stored', SYNCED_LEVEL)
        .uponReceiving('the stored levels')
        .withRequest('GET', '/v1/levels')
        .willRespondWith(200, (builder) => builder.jsonBody({ levels: MatchersV3.eachLike(fit01) }))
        .executeTest(async (mockServer) => {
          const api: LevelsApi = createApiClient(mockServer.url);

          await expect(api.getLevels()).resolves.toEqual({ levels: [fit01] });
        });
    });

    // The gateway maps this 404 to `level-has-no-board` (hexablock-api#134).
    it('should_reject_with_the_status_404_when_the_backend_holds_no_level_of_the_leaderboard', async () => {
      await pact
        .addInteraction()
        .given('a signed-in account exists', { username: ADA.username })
        .uponReceiving('the leaderboard of a level that is not stored')
        .withRequest('GET', `/v1/leaderboard/hexa-fit/levels/${UNKNOWN_LEVEL}`, (builder) =>
          builder.headers({
            Authorization: MatchersV3.fromProviderState(
              'Bearer ${accessToken}',
              `Bearer ${EXAMPLE_TOKEN}`,
            ),
          }),
        )
        .willRespondWith(404)
        .executeTest(async (mockServer) => {
          const api: LeaderboardApi = createApiClient(mockServer.url);

          const failure = await failureOf(
            api.levelLeaderboard(EXAMPLE_TOKEN, 'hexa-fit', UNKNOWN_LEVEL),
          );

          expect(failure.status).toBe(404);
          expect(failure.message).not.toContain(EXAMPLE_TOKEN);
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
    // The rows of the boards of the fake provider: the result of ada on the stored level.
    const LEVEL_ROW = {
      rank: 1,
      userId: EXAMPLE_USER,
      username: 'ada',
      stars: 3,
      moves: 10,
      elapsedMs: 45000,
    };
    const BOARD_ROW = { ...LEVEL_ROW, levelsCompleted: 1 };
    let backend: FakeBackend | undefined;

    afterEach(async () => {
      await backend?.close();
      backend = undefined;
    });

    // A fake provider that honors every interaction of the pact (hexablock-api #151).
    // It keeps the provider state that the verifier set up last before the current interaction,
    // and it gives the token of the states `a signed-in account exists` and `several accounts have
    // results on a stored level`. An interaction of #46 sets up two states, and the sync answers
    // only the token of the state. The boards of #47 answer only that token too, and only the
    // level of the state has a board.
    function fakeProvider(health: unknown = { status: 'ok' }): FakeRoutes {
      let state = '';
      return {
        '/v1/_pact/provider-states': (request) => {
          const change = JSON.parse(request.body || '{}') as { state?: string; action?: string };
          state = change.action === 'setup' ? (change.state ?? '') : '';
          const signedIn = state === 'a signed-in account exists' || state === RESULTS_STATE;
          return { status: 200, body: signedIn ? { accessToken: STATE_TOKEN } : {} };
        },
        '/v1/health': { status: 200, body: health },
        // A password shorter than 8 characters breaks the rule of `CredentialsDto`.
        '/v1/auth/register': (request) =>
          (JSON.parse(request.body) as { password: string }).password.length < 8
            ? { status: 400, body: { statusCode: 400 } }
            : state === 'an account exists'
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
        '/v1/progress': (request) =>
          request.headers.authorization === `Bearer ${STATE_TOKEN}`
            ? {
                status: 200,
                body: {
                  ...(JSON.parse(request.body) as object),
                  highScore: null,
                  updatedAt: EXAMPLE_UPDATED_AT,
                },
              }
            : { status: 401, body: { statusCode: 401 } },
        '/v1/leaderboard/hexa-fit': (request) =>
          request.headers.authorization === `Bearer ${STATE_TOKEN}`
            ? { status: 200, body: { gameId: 'hexa-fit', highScores: [], standings: [BOARD_ROW] } }
            : { status: 401, body: { statusCode: 401 } },
        '/v1/leaderboard/hexa-fit/levels/fit-01': (request) =>
          request.headers.authorization === `Bearer ${STATE_TOKEN}`
            ? { status: 200, body: { ...BOARD_LEVEL, entries: [LEVEL_ROW] } }
            : { status: 401, body: { statusCode: 401 } },
        // The stored level of the state `a level is stored`.
        '/v1/levels': { status: 200, body: { levels: [fit01] } },
        [`/v1/leaderboard/hexa-fit/levels/${UNKNOWN_LEVEL}`]: (request) =>
          request.headers.authorization === `Bearer ${STATE_TOKEN}`
            ? { status: 404, body: { statusCode: 404 } }
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
      const syncs = requests.filter(({ url }) => url === '/v1/progress');

      expect(result.status).toBe(0);
      expect(new Set(setUp)).toEqual(
        new Set([
          'no account exists',
          'an account exists',
          'a signed-in account exists',
          'a level is stored',
          RESULTS_STATE,
        ]),
      );
      expect(me?.headers.authorization).toBe(`Bearer ${STATE_TOKEN}`);
      expect(new Set(syncs.map(({ headers }) => headers.authorization))).toEqual(
        new Set([`Bearer ${STATE_TOKEN}`, `Bearer ${REFUSED_TOKEN}`]),
      );
    });

    it('should_fail_contract_verify_when_backend_breaks_the_health_body', async () => {
      backend = await startFakeBackend(fakeProvider({ status: 'down' }));

      const result = await contractVerify(backend.url);

      expect(result.status).not.toBe(0);
      expect(result.output).toContain('a health check');
    });
  });
});
