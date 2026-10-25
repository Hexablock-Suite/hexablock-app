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

  it('should_verify_pact_and_api_types_against_backend_main_when_job_contract_runs', () => {
    const workflow = read('.github/workflows/ci.yml');
    const contractJob = workflow.split(/^ {2}contract:\n/m)[1] ?? '';
    const scripts = JSON.parse(read('package.json')).scripts;

    expect(workflow).toMatch(/^ {2}contract:\n {4}name: contract$/m);
    expect(contractJob).toMatch(/repository: Hexablock-Suite\/hexablock-api\n {10}ref: main/);
    expect(contractJob).toMatch(/curl --silent --fail "\$BACKEND_URL\/health"/);
    expect(contractJob).toMatch(/^ {6}- run: pnpm contract:verify\n {6}- run: pnpm api:check$/m);
    expect(scripts['contract:verify']).toBe('node scripts/contract/verify-provider.mjs');
    expect(scripts['api:check']).toBe('node scripts/contract/api-types.mjs check');
    expect(scripts['api:generate']).toBe('node scripts/contract/api-types.mjs generate');
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
