/** @jest-environment node */
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repoRoot, runTool } from '../support/run-tool';

// Issue 71 trap: `pnpm arch` is green on an empty engine, so a green run alone proves nothing.
// These tests copy the real engine code to a scratch tree, add one wrong import
// to the real `game-engine.ts`, and check that the architecture rules fail.

const scratch = mkdtempSync(path.join(tmpdir(), 'hexablock-arch-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// The engine imports the shared leaves and the progress, so the copy holds them too (issue #420).
const GENERIC_FOLDERS = ['engine', 'shared', 'progress', 'achievements'];

// Copies src/domain/engine/ and its sibling folders to <scratch>/<name>/src/domain/
// and returns that root.
// The copy must hold the real `game-engine.ts`, or an import added to it proves nothing.
function copyRealEngine(name: string): string {
  const root = path.join(scratch, name);
  for (const folder of GENERIC_FOLDERS) {
    cpSync(path.join(repoRoot, 'src/domain', folder), path.join(root, 'src/domain', folder), {
      recursive: true,
    });
  }
  expect(existsSync(path.join(root, 'src/domain/engine/turn/game-engine.ts'))).toBe(true);
  return root;
}

function cruise(root: string) {
  return runTool('depcruise', [
    '--config',
    '.dependency-cruiser.cjs',
    '--output-type',
    'err',
    path.join(root, 'src'),
  ]);
}

describe('architecture gate on the real engine code', () => {
  it('should_pass_arch_when_the_real_engine_is_copied_unchanged', () => {
    const result = cruise(copyRealEngine('unchanged'));

    expect(result.output).toContain('no dependency violations found');
    expect(result.status).toBe(0);
  });

  it('should_fail_engine_no_variants_when_the_real_game_engine_imports_a_variant', () => {
    const root = copyRealEngine('variant-import');
    mkdirSync(path.join(root, 'src/domain/variants/hexa-lines'), { recursive: true });
    writeFileSync(
      path.join(root, 'src/domain/variants/hexa-lines/rules.ts'),
      'export const linesRules = 1;\n',
    );
    appendFileSync(
      path.join(root, 'src/domain/engine/turn/game-engine.ts'),
      "\nexport { linesRules } from '../../variants/hexa-lines/rules';\n",
    );

    const result = cruise(root);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('engine-no-variants');
  });

  // Issue #420: the real progress model imports only the shared leaves.
  it('should_fail_progress_imports_only_shared_when_the_real_progress_model_imports_the_engine', () => {
    const root = copyRealEngine('progress-import');
    appendFileSync(
      path.join(root, 'src/domain/progress/progress-model.ts'),
      "\nexport type { GameEngine } from '../engine/turn/game-engine';\n",
    );

    const result = cruise(root);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('progress-imports-only-shared');
  });

  it('should_fail_domain_no_framework_when_the_real_game_engine_imports_react', () => {
    const root = copyRealEngine('framework-import');
    appendFileSync(
      path.join(root, 'src/domain/engine/turn/game-engine.ts'),
      "\nexport { useState } from 'react';\n",
    );

    const result = cruise(root);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('domain-no-framework');
  });
});
