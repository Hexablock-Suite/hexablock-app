import { ApiFailure } from '../../src/adapters/api/api-failure';
import { apiBaseUrl, DEFAULT_API_URL } from '../../src/infrastructure/api/api-url';
import { createApiClient } from '../../src/infrastructure/api/client';
import { fakeFetch, useFakeFetch } from '../support/fake-fetch';

const ADA = { username: 'ada', password: 'correct horse battery' };

// #45: the HTTP client tells a call that got no answer from a call that the backend refused.
// The pact of test/contract/ checks each answer of the backend.
describe('ApiClient', () => {
  it('should_reject_with_an_api_failure_with_no_status_when_the_backend_does_not_answer', async () => {
    const spy = useFakeFetch(fakeFetch({}, true));
    const api = createApiClient('http://backend.test');

    const thrown = await api.signIn(ADA).then(
      () => undefined,
      (error: unknown) => error,
    );
    spy.mockRestore();

    expect(thrown).toBeInstanceOf(ApiFailure);
    expect((thrown as ApiFailure).status).toBeUndefined();
    expect((thrown as ApiFailure).message).toBe('POST /v1/auth/login got no answer.');
  });
});

// #46: the sync of the progress sends the bearer token of the session.
describe('ApiClient.syncProgress', () => {
  const BODY = {
    gameId: 'hexa-fit',
    results: [{ levelId: 'fit-01', stars: 3, moves: 10, elapsedMs: 45000 }],
  };
  const ANSWER = { ...BODY, highScore: null, updatedAt: '2026-11-27T10:00:00.000Z' };

  it('should_send_the_bearer_token_and_the_body_and_give_the_answer_when_the_backend_syncs', async () => {
    const backend = fakeFetch({ '/v1/progress': { status: 200, body: ANSWER } });
    const spy = useFakeFetch(backend);

    const answer = await createApiClient('http://backend.test').syncProgress('token-of-ada', BODY);
    spy.mockRestore();

    expect(answer).toEqual(ANSWER);
    expect(backend.requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'POST /v1/progress',
    ]);
    expect(backend.requests[0]?.headers.authorization).toBe('Bearer token-of-ada');
    expect(JSON.parse(backend.requests[0]?.body ?? '')).toEqual(BODY);
  });

  it('should_reject_with_an_api_failure_with_the_status_401_when_the_backend_refuses_the_token', async () => {
    const spy = useFakeFetch(
      fakeFetch({ '/v1/progress': { status: 401, body: { statusCode: 401 } } }),
    );

    const thrown = await createApiClient('http://backend.test')
      .syncProgress('token-of-ada', BODY)
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    spy.mockRestore();

    expect(thrown).toBeInstanceOf(ApiFailure);
    expect((thrown as ApiFailure).status).toBe(401);
    expect((thrown as ApiFailure).message).toBe('POST /v1/progress answered 401.');
    expect((thrown as ApiFailure).message).not.toContain('token-of-ada');
  });
});

// #45: the build sets the address of hexablock-api with the variable EXPO_PUBLIC_API_URL.
describe('apiBaseUrl', () => {
  it('should_give_the_configured_address_when_the_build_sets_one', () => {
    expect(apiBaseUrl(' https://api.example.org ')).toBe('https://api.example.org');
  });

  it('should_give_the_local_backend_when_the_build_sets_no_address', () => {
    expect(DEFAULT_API_URL).toBe('http://localhost:3000');
    expect(apiBaseUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(apiBaseUrl('  ')).toBe(DEFAULT_API_URL);
  });
});
