/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-08 (Liskov substitution): the engine treats every variant the same way,
// so no file in `src/domain/engine/` or its subfolders branches on the game id.

const engineDir = path.join(repoRoot, 'src/domain/engine');
const fixtureDir = path.join(repoRoot, 'test/fixtures/engine-game-id');

// A variant id is a kebab-case slug that starts with `hexa-`, for example `hexa-lines`.
const VARIANT_ID = /^hexa-[a-z0-9-]+$/;
const GAME_ID_NAMES = new Set(['gameId', 'GameId']);

const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

// True when the expression reads the game id: one of `names`,
// or a string literal that is a variant id, such as `game.id === 'hexa-lines'`.
function readsGameId(node: ts.Node, names: ReadonlySet<string>): boolean {
  if (ts.isIdentifier(node) && names.has(node.text)) return true;
  if (ts.isStringLiteralLike(node) && VARIANT_ID.test(node.text)) return true;
  return ts.forEachChild(node, (child) => (readsGameId(child, names) ? true : undefined)) ?? false;
}

// The names that read the game id in one file: `gameId`, `GameId`, and each variable
// whose value is a variant id or a name or property chain that reads the game id,
// such as `const LINES = 'hexa-lines'` or `const id = this.gameId.value`.
function gameIdNames(file: ts.SourceFile): Set<string> {
  const names = new Set(GAME_ID_NAMES);
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = node.initializer;
      const isChain = ts.isIdentifier(value) || ts.isPropertyAccessExpression(value);
      const isVariantId = ts.isStringLiteralLike(value) && VARIANT_ID.test(value.text);
      if (isVariantId || (isChain && readsGameId(value, names))) names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

// The parts of a conditional that choose the branch. A `switch` also chooses by its case labels.
// The left operand of `&&`, `||` or `??` chooses whether the right operand runs.
// A lookup chooses by its key, or by the variant id keys of an inline table.
function conditionsOf(node: ts.Node): { kind: string; parts: ts.Node[] } | undefined {
  if (ts.isIfStatement(node)) return { kind: 'if', parts: [node.expression] };
  if (ts.isConditionalExpression(node)) return { kind: 'ternary', parts: [node.condition] };
  if (ts.isSwitchStatement(node)) {
    const labels = node.caseBlock.clauses.filter(ts.isCaseClause).map((c) => c.expression);
    return { kind: 'switch', parts: [node.expression, ...labels] };
  }
  if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
    return { kind: 'logical', parts: [node.left] };
  }
  if (ts.isElementAccessExpression(node)) {
    const table = ts.isObjectLiteralExpression(node.expression) ? [node.expression] : [];
    return { kind: 'lookup', parts: [node.argumentExpression, ...table] };
  }
  return undefined;
}

// Lists each `if`, `switch`, ternary, logical operator or lookup whose condition reads
// the game id, as `<file>:<line> <kind>`. The TypeScript parser reads the code, so a comment
// or a string outside a condition never counts.
function gameIdConditionals(source: string, fileName: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const names = gameIdNames(file);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const conditional = conditionsOf(node);
    if (conditional !== undefined && conditional.parts.some((part) => readsGameId(part, names))) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      found.push(`${fileName}:${line} ${conditional.kind}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function fixtureConditionals(name: string): string[] {
  return gameIdConditionals(readFileSync(path.join(fixtureDir, name), 'utf8'), name);
}

// Reads every `.ts` and `.tsx` file under `dir`, at any depth.
function scan(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .flatMap((file) => gameIdConditionals(readFileSync(path.join(dir, file), 'utf8'), file));
}

describe('engine game id gate', () => {
  it('should_report_each_wrong_conditional_when_the_fixtures_branch_on_the_game_id', () => {
    expect(scan(fixtureDir)).toEqual([
      'constant-variant-id.ts:7 if',
      'constant-variant-id.ts:8 ternary',
      'if-on-game-id.ts:5 if',
      'logical-on-game-id.ts:6 logical',
      'logical-on-game-id.ts:7 logical',
      'lookup-by-variant-id.ts:3 lookup',
      'lookup-by-variant-id.ts:7 lookup',
      'other-prefix-game-id.ts:4 if',
      'switch-case-variant-id.ts:3 switch',
      'switch-on-game-id.ts:6 switch',
      'ternary-on-variant-id.ts:4 ternary',
      'view/board-view.tsx:3 ternary',
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

  // The rule forbids a branch on the game id, so `&&` and `||` count as `if` (APP-NFR-08).
  it('should_report_the_logical_operator_when_its_left_operand_reads_the_game_id', () => {
    expect(fixtureConditionals('logical-on-game-id.ts')).toEqual([
      'logical-on-game-id.ts:6 logical',
      'logical-on-game-id.ts:7 logical',
    ]);
  });

  // A table keyed by the game id changes behavior by variant, as a `switch` does.
  it('should_report_the_lookup_when_a_table_is_read_by_the_game_id_or_keyed_by_variant_ids', () => {
    expect(fixtureConditionals('lookup-by-variant-id.ts')).toEqual([
      'lookup-by-variant-id.ts:3 lookup',
      'lookup-by-variant-id.ts:7 lookup',
    ]);
  });

  it('should_report_the_conditional_when_it_reads_a_constant_that_holds_the_game_id', () => {
    expect(fixtureConditionals('constant-variant-id.ts')).toEqual([
      'constant-variant-id.ts:7 if',
      'constant-variant-id.ts:8 ternary',
    ]);
  });

  // The name check catches a variant id without the `hexa-` prefix (PR 119 review focus).
  it('should_report_the_if_when_it_reads_game_id_and_the_variant_id_has_another_prefix', () => {
    expect(fixtureConditionals('other-prefix-game-id.ts')).toEqual([
      'other-prefix-game-id.ts:4 if',
    ]);
  });

  it('should_report_the_conditional_when_a_tsx_file_in_a_subfolder_branches_on_the_game_id', () => {
    expect(scan(fixtureDir)).toContain('view/board-view.tsx:3 ternary');
  });
});
