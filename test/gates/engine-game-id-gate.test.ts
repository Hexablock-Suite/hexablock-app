/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-08 (Liskov substitution): the engine treats every variant the same way,
// so no file in `src/domain/engine/` branches on the game id.

const engineDir = path.join(repoRoot, 'src/domain/engine');
const fixtureDir = path.join(repoRoot, 'test/fixtures/engine-game-id');

// A variant id is a kebab-case slug that starts with `hexa-`, for example `hexa-lines`.
const VARIANT_ID = /^hexa-[a-z0-9-]+$/;
const GAME_ID_NAMES = new Set(['gameId', 'GameId']);

// True when the expression reads the game id: the name `gameId` or `GameId`,
// or a string literal that is a variant id, such as `game.id === 'hexa-lines'`.
function readsGameId(node: ts.Node): boolean {
  if (ts.isIdentifier(node) && GAME_ID_NAMES.has(node.text)) return true;
  if (ts.isStringLiteralLike(node) && VARIANT_ID.test(node.text)) return true;
  return ts.forEachChild(node, (child) => (readsGameId(child) ? true : undefined)) ?? false;
}

// The parts of a conditional that choose the branch. A `switch` also chooses by its case labels.
function conditionsOf(node: ts.Node): { kind: string; parts: ts.Node[] } | undefined {
  if (ts.isIfStatement(node)) return { kind: 'if', parts: [node.expression] };
  if (ts.isConditionalExpression(node)) return { kind: 'ternary', parts: [node.condition] };
  if (ts.isSwitchStatement(node)) {
    const labels = node.caseBlock.clauses.filter(ts.isCaseClause).map((c) => c.expression);
    return { kind: 'switch', parts: [node.expression, ...labels] };
  }
  return undefined;
}

// Lists each `if`, `switch` or ternary whose condition reads the game id,
// as `<file>:<line> <kind>`. The TypeScript parser reads the code, so a comment
// or a string outside a condition never counts.
function gameIdConditionals(source: string, fileName: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const conditional = conditionsOf(node);
    if (conditional !== undefined && conditional.parts.some(readsGameId)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      found.push(`${fileName}:${line} ${conditional.kind}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function scan(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .flatMap((file) => gameIdConditionals(readFileSync(path.join(dir, file), 'utf8'), file));
}

describe('engine game id gate', () => {
  it('should_report_each_wrong_conditional_when_the_fixtures_branch_on_the_game_id', () => {
    expect(scan(fixtureDir)).toEqual([
      'if-on-game-id.ts:5 if',
      'switch-case-variant-id.ts:3 switch',
      'switch-on-game-id.ts:6 switch',
      'ternary-on-variant-id.ts:4 ternary',
    ]);
  });

  it('should_report_nothing_when_the_fixture_branches_on_other_values', () => {
    const source = readFileSync(path.join(fixtureDir, 'clean.ts'), 'utf8');

    expect(gameIdConditionals(source, 'clean.ts')).toEqual([]);
  });

  it('should_report_nothing_when_the_real_engine_is_scanned', () => {
    expect(readdirSync(engineDir).filter((file) => file.endsWith('.ts')).length).toBeGreaterThan(0);
    expect(scan(engineDir)).toEqual([]);
  });
});
