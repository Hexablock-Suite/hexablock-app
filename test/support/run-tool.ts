import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

export const repoRoot = path.resolve(__dirname, '../..');

export type ToolResult = {
  status: number | null;
  output: string;
};

// Runs a binary from node_modules/.bin at the repository root.
export function runTool(
  binary: string,
  args: string[],
  env: Record<string, string> = {},
  input?: string,
): ToolResult {
  const result = spawnSync(path.join(repoRoot, 'node_modules', '.bin', binary), args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

// Lints one fixture path with the repository lint config.
// A warning also fails, so status 0 means no diagnostic at all.
// On GitHub runners, Oxlint prints GitHub annotations instead of its default format.
// The fixed format keeps the asserted text the same on every machine.
export function lintFixture(relativePath: string): ToolResult {
  return runTool('vp', ['lint', '--deny-warnings', '--format=default', relativePath], {
    LINT_FIXTURES: '1',
  });
}

// Runs a repository Node script without blocking the event loop.
// A fake backend in the same test process can answer while the script runs.
export function runNodeScript(
  script: string,
  args: string[],
  env: Record<string, string> = {},
  cwd: string = repoRoot,
): Promise<ToolResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, script), ...args], {
      cwd,
      env: { ...process.env, ...env },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}
