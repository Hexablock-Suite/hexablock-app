/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

describe('CI contract', () => {
  it('should_run_pnpm_verify_in_job_verify_when_ci_workflow_triggers', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toMatch(/^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]$/m);
    expect(workflow).toMatch(/^jobs:\n {2}verify:\n {4}name: verify$/m);
    expect(workflow).toMatch(/^ {6}- run: pnpm verify$/m);
    expect(workflow).toMatch(/node-version-file: \.node-version/);
    expect(workflow).toMatch(/cache: pnpm/);
    expect(workflow).toMatch(/cancel-in-progress: true/);
  });

  it('should_chain_gates_in_order_when_verify_script_runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts;

    expect(scripts.verify).toBe(
      'pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm pact:check && pnpm arch',
    );
  });

  it('should_verify_pact_and_api_types_against_the_selected_api_revision_when_job_contract_runs', () => {
    const workflow = read('.github/workflows/ci.yml');
    const contractJob = workflow.split(/^ {2}contract:\n/m)[1] ?? '';
    const scripts = JSON.parse(read('package.json')).scripts;

    expect(workflow).toMatch(/^ {2}contract:\n {4}name: contract$/m);
    expect(contractJob).toMatch(
      /repository: Hexablock-Suite\/hexablock-api\n {10}ref: \$\{\{ env\.API_REF != '' && env\.API_REF \|\| 'main' \}\}/,
    );
    expect(contractJob).toMatch(/curl --silent --fail "\$BACKEND_URL\/v1\/health"/);
    expect(contractJob).toMatch(/^ {6}- run: pnpm contract:verify\n {6}- run: pnpm api:check$/m);
    expect(scripts['contract:verify']).toBe('node scripts/contract/verify-provider.mjs');
    expect(scripts['api:check']).toBe('node scripts/contract/api-types.mjs check');
    expect(scripts['api:generate']).toBe('node scripts/contract/api-types.mjs generate');
  });

  // hexablock-api issue #158: the job loads the bundled levels into a migrated API and checks
  // them for drift. PUT /v1/levels needs an account in LEVEL_EDITOR_IDS.
  it('should_load_and_check_the_bundled_levels_against_a_migrated_api_when_job_contract_runs', () => {
    const contractJob = read('.github/workflows/ci.yml').split(/^ {2}contract:\n/m)[1] ?? '';
    const scripts = JSON.parse(read('package.json')).scripts;

    expect(contractJob).toMatch(/^ {4}services:\n {6}postgres:\n {8}image: postgres:/m);
    expect(contractJob).toMatch(
      /^ {6}DATABASE_URL: postgres:\/\/hexablock:hexablock@localhost:5432\/hexablock$/m,
    );
    expect(contractJob).toMatch(/pnpm build\n {10}pnpm db:migrate\n/);
    expect(contractJob).toContain('LEVEL_EDITOR_IDS="$user_id"');
    expect(contractJob).toContain('LEVEL_EDITOR_TOKEN=$token');
    expect(contractJob).toMatch(
      /^ {6}- run: pnpm api:check\n(?:.*\n)*? {6}- run: pnpm levels:load\n {6}- run: pnpm levels:check$/m,
    );
    expect(contractJob).toMatch(
      /^ {6}- run: pnpm levels:check\n(?: {6}#[^\n]*\n)* {6}- name: sync a result of a bundled level\n {8}env:\n {10}BUNDLED_LEVELS_LIVE: '1'\n {8}run: pnpm exec jest --selectProjects contract test\/contract\/bundled-levels-sync\.test\.ts$/m,
    );
    expect(scripts['levels:load']).toBe('node scripts/contract/bundled-levels.mjs load');
    expect(scripts['levels:check']).toBe('node scripts/contract/bundled-levels.mjs check');
  });

  it('should_reject_a_paired_api_revision_that_is_not_a_full_commit_sha_when_set', () => {
    const contractJob = read('.github/workflows/ci.yml').split(/^ {2}contract:\n/m)[1] ?? '';

    // The paired ref must be immutable full commit SHA evidence. An invalid or
    // unresolvable ref fails the job; it never falls back to main.
    expect(contractJob).toMatch(
      /^ {6}- name: validate the paired API revision\n(?: {8}#[^\n]*\n)* {8}if: env\.API_REF != ''$/m,
    );
    expect(contractJob).toContain('API_REF must be a full 40-character commit SHA when set');
  });

  it('should_verify_api_main_by_default_when_no_paired_api_revision_is_set', () => {
    const contractJob = read('.github/workflows/ci.yml').split(/^ {2}contract:\n/m)[1] ?? '';

    // The empty-ref expression falls back to main only when API_REF is unset.
    // A set-but-invalid ref never reaches this fallback: the checkout fails.
    expect(contractJob).toMatch(/ref: \$\{\{ env\.API_REF != '' && env\.API_REF \|\| 'main' \}\}/);
    expect(contractJob).toMatch(
      /^ {6}# serves \/v1\. Empty or removed restores the normal API main verification\.$/m,
    );
  });

  it('should_mirror_verify_commands_when_pre_push_hook_runs', () => {
    const verify = JSON.parse(read('package.json')).scripts.verify.split(' && ');
    const prePush = read('.vite-hooks/pre-push')
      .split('\n')
      .filter((line) => line !== '' && !line.startsWith('#'))
      .flatMap((line) => line.split(' && '));

    expect(prePush).toEqual(['pnpm lint', 'pnpm typecheck', 'pnpm arch']);
    expect(prePush.filter((command) => !verify.includes(command))).toEqual([]);
  });

  it('should_pin_node_26_when_node_version_file_is_read', () => {
    expect(read('.node-version').trim()).toBe('26');
  });
});
