/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// Issue #244, classes.md decision 43: each Fit move holds its own check and its own change.
// `FitRules` asks the move, so no code of the Fit variant tells the moves apart by their class.
// A new kind of move then adds a class and changes no function that checks a move.
// The gate reads every `.ts` file of `src/domain/variants/hexa-fit/` with the TypeScript parser.
// It lists each `instanceof` whose right operand names a class of `fit-move.ts`:
// the class name, an alias of its import, or a name read through a namespace import.
// The parser reads the code, so a comment or a string never counts.

const fitDir = path.join(repoRoot, 'src/domain/variants/hexa-fit');
const MOVE_FILE = 'fit-move.ts';
const MOVE_MODULE = /(^|\/)fit-move$/;

// The names of the classes that the move file declares: the Fit moves.
function moveClassesIn(source: string): Set<string> {
  const file = ts.createSourceFile(MOVE_FILE, source, ts.ScriptTarget.Latest, true);
  const names = file.statements
    .filter(ts.isClassDeclaration)
    .flatMap((node) => (node.name === undefined ? [] : [node.name.text]));
  return new Set(names);
}

// The names that stand for a Fit move class in one file: each class name,
// each local name that an import of the move module binds to a class,
// and `<namespace>.<class>` for a namespace import of that module.
function moveNamesIn(file: ts.SourceFile, moves: ReadonlySet<string>): Set<string> {
  const names = new Set(moves);
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = statement.moduleSpecifier;
    if (!ts.isStringLiteral(from) || !MOVE_MODULE.test(from.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      for (const move of moves) names.add(`${bindings.name.text}.${move}`);
      continue;
    }
    for (const element of bindings.elements) {
      if (moves.has((element.propertyName ?? element.name).text)) names.add(element.name.text);
    }
  }
  return names;
}

// Each `instanceof` on a Fit move in one file, as `<file>:<line>`.
function moveTypeChecks(source: string, fileName: string, moves: ReadonlySet<string>): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const names = moveNamesIn(file, moves);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
      names.has(node.right.getText(file))
    ) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      found.push(`${fileName}:${line}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function readFit(file: string): string {
  return readFileSync(path.join(fitDir, file), 'utf8');
}

describe('Fit move dispatch gate', () => {
  it('should_report_each_instanceof_on_a_fit_move_when_a_fixture_tells_the_moves_apart_by_class', () => {
    const moves = new Set(['PlaceFitPiece', 'RemoveFitPiece', 'RotateFitPiece']);
    const source = [
      "import { PlaceFitPiece, RemoveFitPiece as Removal } from './fit-move';",
      "import * as moves from './fit-move';",
      "import { FitState } from './fit-state';",
      'export function kindOf(move: unknown, other: unknown): boolean {',
      '  if (move instanceof PlaceFitPiece) return true;',
      '  if (move instanceof Removal) return true;',
      '  if (move instanceof moves.RotateFitPiece) return true;',
      '  // move instanceof PlaceFitPiece',
      "  const text = 'move instanceof PlaceFitPiece';",
      '  return other instanceof FitState && text.length > 0;',
      '}',
    ].join('\n');

    expect(moveTypeChecks(source, 'rules.ts', moves)).toEqual([
      'rules.ts:5',
      'rules.ts:6',
      'rules.ts:7',
    ]);
  });

  it('should_report_no_instanceof_on_a_fit_move_when_the_fit_variant_is_scanned', () => {
    const moves = moveClassesIn(readFit(MOVE_FILE));
    const files = readdirSync(fitDir)
      .filter((file) => file.endsWith('.ts'))
      .sort();

    // The scan read the three moves and the rules, so an empty result is not a missed read.
    expect([...moves].sort()).toEqual(['PlaceFitPiece', 'RemoveFitPiece', 'RotateFitPiece']);
    expect(files).toContain('fit-rules.ts');
    expect(files.flatMap((file) => moveTypeChecks(readFit(file), file, moves))).toEqual([]);
  });
});
