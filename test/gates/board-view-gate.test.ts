/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// Issue #165: `BoardView` draws every figure through `BoardLayout` and every variant
// through `CellRenderer` (D3, D4). So it never branches on the figure or on the game id.
// The gate reads `src/infrastructure/board/board-view.tsx`. The file holds no `if`, `switch`,
// conditional expression, `&&`, `||`, `??` or table lookup (`table[key]`).
// It imports only React, React Native and the two interfaces of its folder, so it cannot
// name a figure, a layout class, a geometry, a topology or a game id. Since #170 it takes
// the pairs of `GameViewModel.cells`, so it imports no response model either.

const boardView = path.join(repoRoot, 'src/infrastructure/board/board-view.tsx');

const ALLOWED_IMPORTS = new Set(['react', 'react-native', './board-layout', './cell-renderer']);

const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

// The kind of branch or lookup that a node is, or none.
function branchOf(node: ts.Node): string | undefined {
  if (ts.isIfStatement(node)) return 'if';
  if (ts.isSwitchStatement(node)) return 'switch';
  if (ts.isConditionalExpression(node)) return 'ternary';
  if (ts.isElementAccessExpression(node)) return 'lookup';
  if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
    return 'logical';
  }
  return undefined;
}

// The branches, the lookups and the imports that are not allowed in one source text.
function problemsIn(text: string): string[] {
  const file = ts.createSourceFile('board-view.tsx', text, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    const branch = branchOf(node);
    if (branch !== undefined) problems.push(`${branch}: ${node.getText(file)}`);
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const from = node.moduleSpecifier.text;
      if (!ALLOWED_IMPORTS.has(from)) problems.push(`import: ${from}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}

describe('BoardView gate', () => {
  it('should_find_no_branch_no_lookup_and_no_figure_import_when_board_view_is_read', () => {
    expect(problemsIn(readFileSync(boardView, 'utf8'))).toEqual([]);
  });

  it('should_report_each_branch_lookup_and_import_when_a_view_chooses_by_the_figure', () => {
    const source = [
      "import { HexLayout } from './hex-layout';",
      "import { TopologyId } from '../../domain/engine/geometry-factory';",
      'export function Wrong({ id, gameId, sizes }) {',
      '  if (id.equals(TopologyId.hex)) return null;',
      "  switch (gameId) { case 'hexa-lines': return null; }",
      '  const size = sizes[gameId] ?? 1;',
      '  return id.equals(TopologyId.square) ? size : new HexLayout(size);',
      '}',
    ].join('\n');

    expect(problemsIn(source).map((problem) => problem.split(':')[0])).toEqual([
      'import',
      'import',
      'if',
      'switch',
      'logical',
      'lookup',
      'ternary',
    ]);
  });
});
