import { spawnSync } from 'node:child_process';
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
export function lintFixture(relativePath: string): ToolResult {
  return runTool('vp', ['lint', '--deny-warnings', relativePath], { LINT_FIXTURES: '1' });
}
