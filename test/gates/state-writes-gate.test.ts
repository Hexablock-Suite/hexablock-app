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
// - a call of `Object.assign()` whose target is not `this` or a field of `this`.
// So the rules, the scoring and the engine change a state only through its methods.
// R8 makes every field of the four variant states private, and a reader reads the photo
// that `snapshot()` gives. The scan of the state files reports a field that is not private.
// The compiler then refuses what the scan of the writes cannot see on a state: an array change
// such as `state.clearedTiles.push()`, a draw such as `state.tiles.next()`, and a write from
// a class that declares a field of the same name. `test/domain/engine/state-snapshot.test.ts`
// proves it at compile time, so this gate keeps no case for it.

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

// The first argument of a call of `Object.assign()`, or `undefined` for any other node.
function assignTarget(node: ts.Node): ts.Expression | undefined {
  if (!ts.isCallExpression(node) || node.expression.getText() !== 'Object.assign') return undefined;
  return node.arguments[0];
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
    const target = node.kind === ts.SyntaxKind.CallExpression ? assignTarget(node) : undefined;
    if (target !== undefined && !startsAtThis(target) && !ts.isObjectLiteralExpression(target)) {
      report(node, `assigns into ${target.getText()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// A field that a class declares or that its constructor declares as a parameter property.
// A field is private when it has the `private` modifier or a `#` name.
function isPrivateField(member: ts.PropertyDeclaration | ts.ParameterDeclaration): boolean {
  if (ts.isPrivateIdentifier(member.name)) return true;
  return (ts.getModifiers(member) ?? []).some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);
}

// The fields of the classes of one state file that are not private.
function publicFieldsOf(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const report = (node: ts.Node, name: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    found.push(`${file}:${line}: public field ${name}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isClassLike(node)) {
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && !isPrivateField(member)) {
          report(member, member.name.getText());
        }
        if (ts.isConstructorDeclaration(member)) {
          for (const parameter of member.parameters) {
            if (
              ts.isParameterPropertyDeclaration(parameter, member) &&
              !isPrivateField(parameter)
            ) {
              report(parameter, parameter.name.getText());
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// The state file of each variant: `src/domain/variants/<variant>/<name>-state.ts`.
function stateFiles(): string[] {
  const variants = path.join(repoRoot, 'src/domain/variants');
  return readdirSync(variants, { recursive: true, encoding: 'utf8' })
    .map((file) => path.posix.join('src/domain/variants', file.split(path.sep).join('/')))
    .filter((file) => /^src\/domain\/variants\/[^/]+\/[^/]+-state\.ts$/.test(file))
    .sort();
}

function sourceFiles(): string[] {
  return scanned.flatMap((dir) =>
    readdirSync(path.join(repoRoot, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => path.posix.join(dir, file.split(path.sep).join('/'))),
  );
}

describe('state writes gate (R7 and R8)', () => {
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

  it('should_report_object_assign_when_a_source_assigns_into_another_object', () => {
    const text = [
      'Object.assign(state, { score: 1 });',
      'Object.assign(this, values);',
      'Object.assign({}, state);',
    ].join('\n');

    expect(scanSource('src/domain/variants/hexa-sort/sort-rules.ts', text)).toEqual([
      'src/domain/variants/hexa-sort/sort-rules.ts:1: assigns into state',
    ]);
  });

  it('should_report_each_public_field_when_a_variant_state_declares_one', () => {
    const text = [
      'class LinesState {',
      '  readonly tray: Piece[] = [];',
      '  public streak = 0;',
      '  private score = 0;',
      '  #hidden = 0;',
      '  constructor(readonly board: Board, public source: Source, private readonly id: Id) {}',
      '}',
    ].join('\n');

    expect(publicFieldsOf('src/domain/variants/hexa-lines/lines-state.ts', text)).toEqual([
      'src/domain/variants/hexa-lines/lines-state.ts:2: public field tray',
      'src/domain/variants/hexa-lines/lines-state.ts:3: public field streak',
      'src/domain/variants/hexa-lines/lines-state.ts:6: public field board',
      'src/domain/variants/hexa-lines/lines-state.ts:6: public field source',
    ]);
  });

  it('should_find_no_public_field_when_the_four_variant_states_are_scanned', () => {
    const files = stateFiles();
    const fields = files.flatMap((file) =>
      publicFieldsOf(file, readFileSync(path.join(repoRoot, file), 'utf8')),
    );

    expect(files).toEqual([
      'src/domain/variants/hexa-fit/fit-state.ts',
      'src/domain/variants/hexa-lines/lines-state.ts',
      'src/domain/variants/hexa-merge/merge-state.ts',
      'src/domain/variants/hexa-sort/sort-state.ts',
    ]);
    expect(fields).toEqual([]);
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
