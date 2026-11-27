import { ApiFailure } from '../../src/adapters/api/api-failure';
import { apiBaseUrl, DEFAULT_API_URL } from '../../src/infrastructure/api/api-url';
import { createApiClient, LEVELS_TIMEOUT_MS } from '../../src/infrastructure/api/client';
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

// #48: the levels of the backend. `GET /v1/levels` has no guard, so the request sends no token.
// `fetch` of React Native can wait with no end, so the client stops the request after
// `LEVELS_TIMEOUT_MS`. `ApiLevelRepository` never waits for it: the limit only frees the request.
describe('ApiClient.getLevels', () => {
  const ANSWER = {
    levels: [
      {
        gameId: 'hexa-fit',
        levelId: 'fit-16',
        order: 16,
        version: 1,
        topology: 'hex',
        section: { figure: [[0, 0]], pieces: [], witness: [], stars: [] },
      },
    ],
    unavailable: [{ gameId: 'hexa-fit', levelId: 'fit-17', reason: 'invalid-section' }],
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should_send_no_token_and_give_the_answer_when_the_backend_answers_the_levels', async () => {
    const backend = fakeFetch({ '/v1/levels': { status: 200, body: ANSWER } });
    const spy = useFakeFetch(backend);

    const answer = await createApiClient('http://backend.test').getLevels();
    spy.mockRestore();

    expect(answer).toEqual(ANSWER);
    expect(backend.requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET /v1/levels',
    ]);
    expect(backend.requests[0]?.headers.authorization).toBeUndefined();
  });

  it('should_reject_with_an_api_failure_with_the_status_when_the_backend_answers_another_status_than_200', async () => {
    const spy = useFakeFetch(
      fakeFetch({ '/v1/levels': { status: 500, body: { statusCode: 500 } } }),
    );

    const thrown = await createApiClient('http://backend.test')
      .getLevels()
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    spy.mockRestore();

    expect(thrown).toBeInstanceOf(ApiFailure);
    expect((thrown as ApiFailure).status).toBe(500);
    expect((thrown as ApiFailure).message).toBe('GET /v1/levels answered 500.');
  });

  // The fetch double never answers. It rejects only when the client aborts the request, so only
  // the time limit ends the call. The fake timers of Jest move the time, so the test waits for
  // no real time.
  it('should_reject_with_an_api_failure_with_no_status_when_the_backend_does_not_answer_within_the_time_limit', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(
      (input) =>
        new Promise((_resolve, reject) => {
          const { signal } = input as Request;
          const abort = () => reject(new DOMException('The request was aborted.', 'AbortError'));
          if (signal.aborted) abort();
          signal.addEventListener('abort', abort);
        }),
    );
    let thrown: unknown = 'pending';

    const call = createApiClient('http://backend.test')
      .getLevels()
      .then(
        () => 'answered',
        (error: unknown) => error,
      )
      .then((outcome) => {
        thrown = outcome;
      });
    await jest.advanceTimersByTimeAsync(LEVELS_TIMEOUT_MS - 1);
    const beforeTheLimit = thrown;
    await jest.advanceTimersByTimeAsync(1);
    await call;
    spy.mockRestore();

    expect(LEVELS_TIMEOUT_MS).toBe(5000);
    expect(beforeTheLimit).toBe('pending');
    expect(thrown).toBeInstanceOf(ApiFailure);
    expect((thrown as ApiFailure).status).toBeUndefined();
    expect((thrown as ApiFailure).message).toBe('GET /v1/levels got no answer.');
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
