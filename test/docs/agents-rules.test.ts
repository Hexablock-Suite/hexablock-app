/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

const MARKER = /<!-- rule: (R-[a-z0-9-]+) -->/;
const MODAL = /\b(MUST|Never|Do not)\b/;

const scripts: Record<string, string> = JSON.parse(
  readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
).scripts;

// Returns the AGENTS.md lines outside code fences.
function agentLines(): string[] {
  const text = readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  return text.replace(/```[\s\S]*?```/g, '').split('\n');
}

// A gate is "no gate", or backticked paths and pnpm scripts that exist.
function gateProblem(line: string): string | null {
  const gate = line.split('Gate:')[1]?.replace(MARKER, '').trim();
  if (gate === undefined) return `no "Gate:" in: ${line}`;
  if (gate.startsWith('no gate')) return null;
  const refs = [...gate.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  if (refs.length === 0) return `gate names no path or script: ${line}`;
  for (const ref of refs) {
    const script = ref.match(/^pnpm (\S+)$/)?.[1];
    const exists = script ? script in scripts : existsSync(path.join(repoRoot, ref));
    if (!exists) return `gate reference does not exist: ${ref}`;
  }
  return null;
}

describe('AGENTS.md rule markers', () => {
  it('should_name_an_existing_gate_or_no_gate_when_rule_has_marker', () => {
    const problems = agentLines()
      .filter((line) => MARKER.test(line))
      .map(gateProblem)
      .filter((problem) => problem !== null);

    expect(problems).toEqual([]);
  });

  it('should_carry_a_marker_when_line_states_a_rule', () => {
    const unmarked = agentLines().filter((line) => MODAL.test(line) && !MARKER.test(line));

    expect(unmarked).toEqual([]);
  });

  it('should_use_unique_ids_when_markers_are_listed', () => {
    const ids = agentLines()
      .map((line) => line.match(MARKER)?.[1])
      .filter((id) => id !== undefined);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
