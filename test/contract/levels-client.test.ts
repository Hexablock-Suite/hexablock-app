import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApiClient, LEVELS_TIMEOUT_MS } from '../../src/infrastructure/api/client';
import { startFakeBackend, type FakeBackend } from '../support/fake-backend';

// Issue #48: the client asks hexablock-api for the stored levels. `fetch` of React Native can wait
// with no end, so the client stops the request after a time limit. The app then plays its bundled
// levels. The pact of `health-contract.test.ts` pins the answer of the backend.

// Starts a server on a free local port that never answers a request.
async function silentServer(): Promise<Server> {
  const server = createServer(() => undefined);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

describe('levels client', () => {
  let server: Server | undefined;
  let backend: FakeBackend | undefined;

  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise<void>((resolve) =>
      server === undefined ? resolve() : server.close(() => resolve()),
    );
    server = undefined;
    await backend?.close();
    backend = undefined;
  });

  // The server never answers, so only the time limit stops the request: the client aborts it.
  it('should_reject_the_levels_request_when_the_backend_does_not_answer_within_the_time_limit', async () => {
    server = await silentServer();
    const { port } = server.address() as AddressInfo;
    const api = createApiClient(`http://127.0.0.1:${port}`, 200);

    await expect(api.getLevels()).rejects.toMatchObject({ name: 'AbortError' });
  });

  // A phone on a slow network still gets the levels in a few seconds.
  it('should_wait_five_seconds_for_the_levels_when_no_time_limit_is_given', () => {
    expect(LEVELS_TIMEOUT_MS).toBe(5000);
  });

  it('should_reject_the_levels_request_when_the_backend_answers_another_status_than_200', async () => {
    backend = await startFakeBackend({ '/v1/levels': { status: 500, body: { message: 'Down' } } });

    await expect(createApiClient(backend.url).getLevels()).rejects.toThrow(
      'GET /v1/levels failed with status 500',
    );
  });
});
