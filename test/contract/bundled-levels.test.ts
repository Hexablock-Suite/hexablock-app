import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { startFakeBackend, unusedBackendUrl, type FakeBackend } from '../support/fake-backend';
import { repoRoot, runNodeScript } from '../support/run-tool';

// hexablock-api issue #158: pnpm levels:load sends the bundled level files to PUT /v1/levels,
// and pnpm levels:check compares them with GET /v1/levels.
type LevelFile = { gameId: string; levelId: string; version: number; section: unknown };

const levelsDir = path.join(repoRoot, 'src/adapters/levels');

// The bundled level files, Fit first, each folder in file name order.
const bundled: LevelFile[] = ['fit', 'sort'].flatMap((folder) =>
  readdirSync(path.join(levelsDir, folder))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(levelsDir, folder, name), 'utf8'))),
);

// The stored copies, with one level replaced.
const storedWith = (levelId: string, change: (level: LevelFile) => LevelFile) =>
  bundled.map((level) => (level.levelId === levelId ? change(structuredClone(level)) : level));

const levelsScript = (mode: string, env: Record<string, string>) =>
  runNodeScript('scripts/contract/bundled-levels.mjs', [mode], env);

describe('bundled level drift check (pnpm levels:check)', () => {
  let backend: FakeBackend | undefined;

  afterEach(async () => {
    await backend?.close();
    backend = undefined;
  });

  const check = async (body: unknown, status = 200) => {
    backend = await startFakeBackend({ '/v1/levels': { status, body } });
    return levelsScript('check', { BACKEND_URL: backend.url });
  };

  it('should_fail_and_name_the_level_when_a_bundled_file_differs_from_the_stored_copy', async () => {
    const levels = storedWith('fit-01', (level) => ({ ...level, section: { changed: true } }));

    const result = await check({ levels });

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'hexa-fit/fit-01: the stored copy differs from src/adapters/levels/fit/fit-01.json.',
    );
    expect(result.output).toContain('1 of 37 bundled levels differ from the levels at');
    expect(result.output).toContain('pnpm levels:load');
    expect(result.output).not.toContain('hexa-fit/fit-02');
    expect(backend?.requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET /v1/levels',
    ]);
  });

  it('should_pass_when_the_stored_copy_has_a_higher_version_than_its_bundled_file', async () => {
    const levels = storedWith('sort-01', (level) => ({
      ...level,
      version: level.version + 1,
      section: { changed: true },
    }));

    const result = await check({ levels });

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'hexa-sort/sort-01: the backend keeps a higher version (2 > 1), as S3-10 allows.',
    );
    expect(result.output).toContain('The 37 bundled levels match the levels at');
  });

  it('should_fail_when_the_stored_copy_has_a_lower_version_than_its_bundled_file', async () => {
    const levels = storedWith('fit-02', (level) => ({ ...level, version: 0 }));

    const result = await check({ levels });

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'hexa-fit/fit-02: the stored copy differs from src/adapters/levels/fit/fit-02.json.',
    );
  });

  it('should_pass_when_every_stored_copy_equals_its_bundled_file_and_the_backend_holds_more', async () => {
    const extra = { ...bundled[0], levelId: 'fit-99' };

    const result = await check({ levels: [...[...bundled].reverse(), extra] });

    expect(result.status).toBe(0);
    expect(result.output).toContain('The 37 bundled levels match the levels at');
  });

  it('should_fail_when_the_backend_holds_no_copy_or_a_broken_copy_of_a_bundled_level', async () => {
    const levels = bundled.filter(({ levelId }) => levelId !== 'fit-03' && levelId !== 'sort-02');
    const unavailable = [{ gameId: 'hexa-sort', levelId: 'sort-02', reason: 'unknown-topology' }];

    const result = await check({ levels, unavailable });

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'hexa-fit/fit-03: the backend holds no copy of src/adapters/levels/fit/fit-03.json.',
    );
    expect(result.output).toContain(
      'hexa-sort/sort-02: the stored copy breaks the rule unknown-topology.',
    );
    expect(result.output).toContain('2 of 37 bundled levels differ from the levels at');
  });

  it('should_fail_when_the_backend_answers_the_read_with_an_error', async () => {
    const result = await check({ message: 'boom' }, 500);

    expect(result.status).toBe(1);
    expect(result.output).toContain('GET /v1/levels answered 500');
  });

  it('should_fail_when_the_backend_is_unreachable', async () => {
    const result = await levelsScript('check', { BACKEND_URL: await unusedBackendUrl() });

    expect(result.status).toBe(1);
    expect(result.output).toContain('Cannot reach the backend at');
    expect(result.output).toContain('BACKEND_URL');
  });
});

describe('bundled level load (pnpm levels:load)', () => {
  let backend: FakeBackend | undefined;
  const token = 'editor-token-for-tests';

  afterEach(async () => {
    await backend?.close();
    backend = undefined;
  });

  const load = async (status: number, body: unknown = null) => {
    backend = await startFakeBackend({ '/v1/levels': { status, body } });
    return levelsScript('load', { BACKEND_URL: backend.url, LEVEL_EDITOR_TOKEN: token });
  };

  it('should_send_every_bundled_file_as_it_is_with_the_token_when_the_load_runs', async () => {
    const result = await load(204);

    expect(result.status).toBe(0);
    expect(result.output).toContain('Sent the 37 bundled levels to');
    expect(result.output).not.toContain(token);
    expect(backend?.requests).toHaveLength(1);
    const [request] = backend?.requests ?? [];
    expect(request?.method).toBe('PUT');
    expect(request?.url).toBe('/v1/levels');
    expect(request?.headers.authorization).toBe(`Bearer ${token}`);
    expect(request?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request?.body ?? '')).toEqual({ levels: bundled });
  });

  it('should_pass_and_name_the_level_when_the_backend_keeps_a_higher_stored_version', async () => {
    const result = await load(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Bad Request Exception',
      details: ['gameId "hexa-fit", levelId "fit-01": older-version'],
      path: '/v1/levels',
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'The backend keeps a higher version of gameId "hexa-fit", levelId "fit-01" (S3-10).',
    );
    expect(result.output).toContain('Sent the 37 bundled levels to');
  });

  it('should_fail_and_print_each_problem_when_the_backend_rejects_the_batch', async () => {
    const result = await load(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Bad Request Exception',
      details: [
        'gameId "hexa-fit", levelId "fit-01": older-version',
        'gameId "hexa-fit", levelId "fit-square-01": unknown-topology',
      ],
      path: '/v1/levels',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('PUT /v1/levels answered 400');
    expect(result.output).toContain('gameId "hexa-fit", levelId "fit-square-01": unknown-topology');
    expect(result.output).not.toContain('Sent the 37 bundled levels');
  });

  it('should_fail_when_the_account_of_the_token_is_not_a_level_editor', async () => {
    const result = await load(403, {
      statusCode: 403,
      error: 'Forbidden',
      message: 'This account may not update levels',
      details: [],
      path: '/v1/levels',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('PUT /v1/levels answered 403');
    expect(result.output).toContain('This account may not update levels');
  });

  it('should_fail_and_send_nothing_when_no_token_is_set', async () => {
    backend = await startFakeBackend({ '/v1/levels': { status: 204, body: null } });

    const result = await levelsScript('load', { BACKEND_URL: backend.url, LEVEL_EDITOR_TOKEN: '' });

    expect(result.status).toBe(1);
    expect(result.output).toContain('LEVEL_EDITOR_TOKEN is not set');
    expect(backend.requests).toEqual([]);
  });

  it('should_fail_when_the_backend_is_unreachable', async () => {
    const result = await levelsScript('load', {
      BACKEND_URL: await unusedBackendUrl(),
      LEVEL_EDITOR_TOKEN: token,
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('Cannot reach the backend at');
  });
});
