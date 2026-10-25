import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runNodeScript } from '../support/run-tool';

// Isolates git from the user and system config, for example a global hooks path.
const gitEnv = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const pactCheck = (repo: string) =>
  runNodeScript('scripts/contract/check-pact-drift.mjs', [], gitEnv, repo);

// Creates a git repository in a temp folder with one committed pact file.
function repoWithCommittedPact(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'pact-drift-'));
  const git = (...args: string[]) =>
    spawnSync('git', args, { cwd: repo, env: { ...process.env, ...gitEnv } });
  git('init', '--quiet');
  mkdirSync(path.join(repo, 'pacts'));
  writeFileSync(path.join(repo, 'pacts/app-api.json'), '{"interactions":[]}\n');
  git('add', 'pacts');
  git('commit', '--quiet', '--no-verify', '-m', 'test: add pact');
  return repo;
}

describe('pact drift check (pnpm pact:check)', () => {
  let repo: string;

  beforeEach(() => {
    repo = repoWithCommittedPact();
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('should_pass_pact_check_when_pact_files_match_the_committed_copy', async () => {
    const result = await pactCheck(repo);

    expect(result.status).toBe(0);
  });

  it('should_fail_pact_check_when_a_pact_file_differs_from_the_committed_copy', async () => {
    writeFileSync(path.join(repo, 'pacts/app-api.json'), '{"interactions":[{}]}\n');

    const result = await pactCheck(repo);

    expect(result.status).toBe(1);
    expect(result.output).toContain('pacts/app-api.json');
    expect(result.output).toContain('Commit the regenerated pact files');
  });

  it('should_fail_pact_check_when_a_pact_file_is_not_committed', async () => {
    writeFileSync(path.join(repo, 'pacts/app-other.json'), '{"interactions":[]}\n');

    const result = await pactCheck(repo);

    expect(result.status).toBe(1);
    expect(result.output).toContain('pacts/app-other.json');
  });
});
