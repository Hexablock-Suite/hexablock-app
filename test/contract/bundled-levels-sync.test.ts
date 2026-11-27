import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot, runNodeScript } from '../support/run-tool';

// hexablock-api issue #158: after the load, a sync with a result of a bundled level is stored.
// Without the load, the backend answers 400 and stores nothing of that sync (DS-6).
// This suite needs a real backend with a database: the CI job contract runs it with
// BUNDLED_LEVELS_LIVE=1, BACKEND_URL and LEVEL_EDITOR_TOKEN. Every other run skips it.
const live = process.env.BUNDLED_LEVELS_LIVE === '1';
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
const level = JSON.parse(
  readFileSync(path.join(repoRoot, 'src/adapters/levels/fit/fit-01.json'), 'utf8'),
);
const result = {
  levelId: level.levelId,
  stars: level.section.stars.length,
  moves: 4,
  elapsedMs: 30000,
};

const call = (route: string, init: RequestInit = {}, token?: string) =>
  fetch(new URL(route, backendUrl), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
  });

// Signs up a new player and gives its token.
async function newPlayerToken(): Promise<string> {
  const credentials = JSON.stringify({
    username: `sync-${randomUUID().slice(0, 8)}`,
    password: 'contract-job-only',
  });
  const signUp = await call('/v1/auth/register', { method: 'POST', body: credentials });
  expect(signUp.status).toBe(201);
  const signIn = await call('/v1/auth/login', { method: 'POST', body: credentials });
  expect(signIn.status).toBe(200);
  return ((await signIn.json()) as { accessToken: string }).accessToken;
}

(live ? describe : describe.skip)('bundled level sync against a real backend', () => {
  it('should_store_a_synced_result_of_a_bundled_level_when_the_bundled_levels_are_loaded', async () => {
    const loaded = await runNodeScript('scripts/contract/bundled-levels.mjs', ['load'], {
      BACKEND_URL: backendUrl,
    });
    expect(loaded.output).toContain('bundled levels to');
    expect(loaded.status).toBe(0);
    const token = await newPlayerToken();

    const synced = await call(
      '/v1/progress',
      { method: 'POST', body: JSON.stringify({ gameId: level.gameId, results: [result] }) },
      token,
    );
    const read = await call(`/v1/progress/${level.gameId}`, {}, token);

    expect(synced.status).toBe(200);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ gameId: level.gameId, results: [result] });
  });
});
