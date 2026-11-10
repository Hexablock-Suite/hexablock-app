/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// R7: the state of a game is an entity inside the `GameEngine` aggregate.
// An entity changes only through its own methods (classes.md decisions 7 and 26).
// The scan reads every TypeScript file of `src/domain/` and `src/application/`. It reports:
// - a write to a field of another object: `=`, a compound assignment, `++` or `--`
//   on a property whose object is not `this` and does not start at `this`.
//   A class may write a field that it declares on another object of its own class,
//   as `clone()` does on its copy. TypeScript allows this for a private field too.
// - a call of `occupy()` or `vacate()` outside `Board` and the variant states.
// So the rules, the scoring and the engine change a state only through its methods.

const scanned = ['src/domain', 'src/application'];

// The files that may call `occupy()` and `vacate()`: the board and the variant states.
function mayChangeTheBoard(file: string): boolean {
  return (
    file === 'src/domain/engine/board.ts' ||
    /^src\/domain\/variants\/[^/]+\/[^/]+-state\.ts$/.test(file)
  );
}

const assignments = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

// True when the chain of property reads starts at `this`, such as `this.done.length`.
function startsAtThis(node: ts.Expression): boolean {
  let base = node;
  while (ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base)) {
    base = base.expression;
  }
  return base.kind === ts.SyntaxKind.ThisKeyword;
}

// The names of the fields that the class around `node` declares, parameter properties included.
function ownFields(node: ts.Node): Set<string> {
  let around: ts.Node | undefined = node.parent;
  while (around !== undefined && !ts.isClassLike(around)) around = around.parent;
  const names = new Set<string>();
  for (const member of around?.members ?? []) {
    if (ts.isPropertyDeclaration(member)) names.add(member.name.getText());
    if (ts.isConstructorDeclaration(member)) {
      for (const parameter of member.parameters) {
        if (ts.isParameterPropertyDeclaration(parameter, member)) {
          names.add(parameter.name.getText());
        }
      }
    }
  }
  return names;
}

// A field of another object, such as `state.score` or `state['score']`.
function isForeignField(node: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return !startsAtThis(node) && !ownFields(node).has(node.name.text);
  }
  return ts.isElementAccessExpression(node) && !startsAtThis(node);
}

// The violations of one source text. `file` is its path from the repository root.
function scanSource(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const report = (node: ts.Node, what: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    found.push(`${file}:${line}: ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      assignments.has(node.operatorToken.kind) &&
      isForeignField(node.left)
    ) {
      report(node, `writes ${node.left.getText()}`);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      isForeignField(node.operand)
    ) {
      report(node, `writes ${node.operand.getText()}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ['occupy', 'vacate'].includes(node.expression.name.text) &&
      !mayChangeTheBoard(file)
    ) {
      report(node, `calls ${node.expression.getText()}()`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function sourceFiles(): string[] {
  return scanned.flatMap((dir) =>
    readdirSync(path.join(repoRoot, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => path.posix.join(dir, file.split(path.sep).join('/'))),
  );
}

describe('state writes gate (R7)', () => {
  it('should_report_each_foreign_write_when_a_source_changes_another_object', () => {
    const text = [
      'state.score += points;',
      'state.tray = [];',
      "state['streak'] = 0;",
      'state.goalsDone++;',
      '--state.cellsPlaced;',
      'this.score += points;',
      'this.done.length = 0;',
      'const total = state.score + 1;',
      'state.board.occupy(at, cell);',
      'board.vacate(at);',
    ].join('\n');

    expect(scanSource('src/domain/variants/hexa-lines/lines-rules.ts', text)).toEqual([
      'src/domain/variants/hexa-lines/lines-rules.ts:1: writes state.score',
      'src/domain/variants/hexa-lines/lines-rules.ts:2: writes state.tray',
      "src/domain/variants/hexa-lines/lines-rules.ts:3: writes state['streak']",
      'src/domain/variants/hexa-lines/lines-rules.ts:4: writes state.goalsDone',
      'src/domain/variants/hexa-lines/lines-rules.ts:5: writes state.cellsPlaced',
      'src/domain/variants/hexa-lines/lines-rules.ts:9: calls state.board.occupy()',
      'src/domain/variants/hexa-lines/lines-rules.ts:10: calls board.vacate()',
    ]);
  });

  it('should_allow_the_write_when_a_class_writes_its_own_field_on_its_copy', () => {
    const text = [
      'class Source {',
      '  private index = 0;',
      '  clone() { const copy = new Source(); copy.index = this.index; return copy; }',
      '  steal(other: { score: number }) { other.score = 1; }',
      '}',
    ].join('\n');

    expect(scanSource('src/domain/engine/piece-source.ts', text)).toEqual([
      'src/domain/engine/piece-source.ts:4: writes other.score',
    ]);
  });

  it('should_allow_the_board_calls_when_a_variant_state_or_the_board_changes_the_board', () => {
    const text = 'this.board.occupy(at, cell);\nthis.board.vacate(at);\nspace.vacate();';

    expect(scanSource('src/domain/variants/hexa-sort/sort-state.ts', text)).toEqual([]);
    expect(scanSource('src/domain/engine/board.ts', text)).toEqual([]);
    expect(scanSource('src/domain/engine/game-engine.ts', text)).toEqual([
      'src/domain/engine/game-engine.ts:1: calls this.board.occupy()',
      'src/domain/engine/game-engine.ts:2: calls this.board.vacate()',
      'src/domain/engine/game-engine.ts:3: calls space.vacate()',
    ]);
  });

  it('should_find_no_foreign_write_when_the_domain_and_the_use_cases_are_scanned', () => {
    const files = sourceFiles();
    const violations = files.flatMap((file) =>
      scanSource(file, readFileSync(path.join(repoRoot, file), 'utf8')),
    );

    expect(files).toEqual(
      expect.arrayContaining([
        'src/domain/engine/game-engine.ts',
        'src/domain/variants/hexa-lines/lines-rules.ts',
        'src/domain/variants/hexa-sort/sort-rules.ts',
        'src/domain/variants/hexa-merge/merge-rules.ts',
        'src/application/apply-move.ts',
      ]),
    );
    expect(violations).toEqual([]);
  });
});
