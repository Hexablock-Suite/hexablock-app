/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import { Board } from '../../src/domain/engine/board';
import { FixedListPieceSource } from '../../src/domain/engine/piece-source';
import { Piece } from '../../src/domain/engine/piece';
import { RegionSize } from '../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../src/domain/engine/shape-node';
import { Turns } from '../../src/domain/engine/turns';
import { FitState } from '../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';
import { Placement } from '../../src/domain/variants/hexa-fit/placement';
import { Color } from '../../src/domain/variants/hexa-lines/color';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { SortState } from '../../src/domain/variants/hexa-sort/sort-state';
import { square, squareTopology, type SquareCoord } from '../support/engine/square-topology';
import { linesState } from '../support/variants/hexa-lines/lines-game';
import { hex, type HexAxis, type HexCoord } from '../support/variants/hexa-merge/hex-topology';
import { mergeState } from '../support/variants/hexa-merge/merge-game';
import { repoRoot } from '../support/run-tool';

// APP-NFR-01: the four variants use the engine `Board` with their own cell type,
// and no variant has a board class of its own (issue #96).
// The static check reads `src/domain/variants/` with the TypeScript parser. It reports:
// - a class whose name ends with `Board`,
// - a class that extends `Board` or a class whose name ends with `Board`,
// - a class member `board` whose type is not the `Board` of `engine/board`.
// The runtime checks build the state of each variant and read the class of its board.

type BoardScan = {
  violations: string[];
  // The classes with a `board` member, so a green scan proves that it read the states.
  holders: string[];
};

const engineBoardModule = /(^|\/)engine\/board$/;

// The local names that an import binds to the `Board` export of the engine module.
// A namespace import `* as engine` binds the qualified name `engine.Board`.
function engineBoardNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = statement.moduleSpecifier;
    if (!ts.isStringLiteral(from) || !engineBoardModule.test(from.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      names.add(`${bindings.name.text}.Board`);
      continue;
    }
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === 'Board') names.add(element.name.text);
    }
  }
  return names;
}

// The `board` members of a class: properties, parameter properties and getters.
function boardMembers(node: ts.ClassLikeDeclaration): (ts.TypeNode | undefined)[] {
  const types: (ts.TypeNode | undefined)[] = [];
  for (const member of node.members) {
    if (ts.isConstructorDeclaration(member)) {
      for (const parameter of member.parameters) {
        const isProperty = ts.getModifiers(parameter)?.length ?? 0;
        if (isProperty > 0 && parameter.name.getText() === 'board') types.push(parameter.type);
      }
    } else if (
      (ts.isPropertyDeclaration(member) || ts.isGetAccessorDeclaration(member)) &&
      member.name.getText() === 'board'
    ) {
      types.push(member.type);
    }
  }
  return types;
}

function scanFile(file: string, label: string, scan: BoardScan): void {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const engineBoards = engineBoardNames(source);
  const visit = (node: ts.Node): void => {
    if (ts.isClassLike(node)) {
      const name = node.name?.text ?? '(anonymous class)';
      if (name.endsWith('Board')) scan.violations.push(`${label}: declares the class ${name}`);
      for (const clause of node.heritageClauses ?? []) {
        if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
        for (const base of clause.types) {
          const text = base.expression.getText();
          if (engineBoards.has(text) || text.endsWith('Board')) {
            scan.violations.push(`${label}: the class ${name} extends ${text}`);
          }
        }
      }
      const members = boardMembers(node);
      if (members.length > 0) scan.holders.push(name);
      for (const type of members) {
        const isEngineBoard =
          type !== undefined &&
          ts.isTypeReferenceNode(type) &&
          engineBoards.has(type.typeName.getText());
        if (!isEngineBoard) {
          const written = type?.getText() ?? 'not written';
          scan.violations.push(`${label}: ${name}.board is ${written}, not the engine Board`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// Scans every TypeScript file under `<root>/src/domain/variants/`.
function scanVariants(root: string): BoardScan {
  const variants = path.join(root, 'src/domain/variants');
  const scan: BoardScan = { violations: [], holders: [] };
  const files = readdirSync(variants, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .sort();
  for (const file of files) scanFile(path.join(variants, file), file, scan);
  return scan;
}

function fixture(name: string): string {
  return path.join(repoRoot, 'test/fixtures/board', name);
}

describe('one board gate (APP-NFR-01)', () => {
  it('should_report_the_variant_board_class_when_a_variant_extends_board', () => {
    const scan = scanVariants(fixture('own-board-class'));

    expect(scan.violations).toEqual([
      'hexa-lines/lines-board.ts: declares the class LinesBoard',
      'hexa-lines/lines-board.ts: the class LinesBoard extends Board',
      'hexa-lines/lines-state.ts: LinesState.board is LinesBoard<TCoord>, not the engine Board',
    ]);
  });

  it('should_report_the_variant_board_class_when_a_variant_declares_a_class_named_board', () => {
    const scan = scanVariants(fixture('board-named-class'));

    expect(scan.violations).toEqual(['hexa-fit/fit-board.ts: declares the class FitBoard']);
  });

  it('should_report_the_state_board_when_a_state_holds_a_board_that_is_not_the_engine_board', () => {
    const scan = scanVariants(fixture('state-board-not-engine'));

    expect(scan.violations).toEqual([
      'hexa-sort/sort-state.ts: SortState.board is not written, not the engine Board',
    ]);
  });

  it('should_report_no_violation_when_the_four_real_variant_states_hold_the_engine_board', () => {
    const scan = scanVariants(repoRoot);

    expect(scan.violations).toEqual([]);
    expect(scan.holders.sort()).toEqual(['FitState', 'LinesState', 'MergeState', 'SortState']);
  });

  it('should_report_the_aliased_class_and_accept_the_aliased_state_board_when_a_variant_imports_board_as_grid', () => {
    const scan = scanVariants(fixture('aliased-import'));

    expect(scan.violations).toEqual([
      'hexa-lines/lines-cells.ts: the class LinesCells extends Grid',
    ]);
    expect(scan.holders).toEqual(['LinesState']);
  });

  it('should_report_no_violation_when_a_state_holds_the_engine_board_through_a_namespace_import', () => {
    const scan = scanVariants(fixture('namespace-import'));

    expect(scan.violations).toEqual([]);
    expect(scan.holders).toEqual(['LinesState']);
  });

  // APP-NFR-01 names a board class. A type alias of the engine `Board` and an interface hold no cells.
  it('should_report_no_violation_when_a_type_alias_and_an_interface_end_with_board', () => {
    const scan = scanVariants(fixture('board-named-types'));

    expect(scan.violations).toEqual([]);
    expect(scan.holders).toEqual([]);
  });

  it('should_report_the_anonymous_class_when_a_class_expression_extends_board', () => {
    const scan = scanVariants(fixture('anonymous-class'));

    expect(scan.violations).toEqual([
      'hexa-merge/merge-board-factory.ts: the class (anonymous class) extends Board',
    ]);
  });

  // The typed variables make `pnpm typecheck` fail when the cell type of a board changes.
  it('should_hold_an_engine_board_of_colors_when_a_lines_state_starts', () => {
    const state = linesState(squareTopology, 2, { filled: [square(0, 0)], tray: [] });
    const board: Board<Color, SquareCoord, string> = state.board;

    expect(board.constructor).toBe(Board);
    expect(state.clone().board.constructor).toBe(Board);
    expect(board.get(square(0, 0))).toBeInstanceOf(Color);
  });

  it('should_hold_an_engine_board_of_piece_ids_when_a_fit_state_places_a_piece', () => {
    const id = PieceId.of('a');
    const figure = new Board<PieceId, SquareCoord, string>(
      squareTopology.region(RegionSize.of(2)),
      squareTopology,
    );
    const piece = new Piece(new ShapeGroup([new CellNode(square(0, 0))]), id);
    const state = FitState.start(figure, new FixedListPieceSource([piece])).place(
      id,
      Placement.of(Turns.of(0), square(0, 0), squareTopology),
    );
    const board: Board<PieceId, SquareCoord, string> = state.board;

    expect(board.constructor).toBe(Board);
    expect(state.clone().board.constructor).toBe(Board);
    expect(board.get(square(0, 0))).toBeInstanceOf(PieceId);
  });

  it('should_hold_an_engine_board_of_color_stacks_when_a_sort_state_starts', () => {
    const start = new Board<ColorStack, SquareCoord, string>(
      squareTopology.region(RegionSize.of(2)),
      squareTopology,
    );
    start.set(square(0, 0), ColorStack.of(['red']));
    const state = SortState.start({
      board: start,
      source: new FixedListPieceSource([]),
      goalsNeeded: 1,
    });
    const board: Board<ColorStack, SquareCoord, string> = state.board;

    expect(board.constructor).toBe(Board);
    expect(state.clone().board.constructor).toBe(Board);
    expect(board.get(square(0, 0))).toBeInstanceOf(ColorStack);
  });

  it('should_hold_an_engine_board_of_merge_tiles_when_a_merge_state_starts', () => {
    const state = mergeState([[hex(0, 0), 2]]);
    const board: Board<MergeTile, HexCoord, HexAxis> = state.board;

    expect(board.constructor).toBe(Board);
    expect(state.clone().board.constructor).toBe(Board);
    expect(board.get(hex(0, 0))).toBeInstanceOf(MergeTile);
  });
});
