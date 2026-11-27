/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// Issue #170: `GamePresenter`, `GameViewModel` and the `StateMapper` interface serve every game,
// so they name no variant. The gate reads `src/adapters/game-presenter.ts`, which holds
// the presenter and the view model, and `src/adapters/state-mapper.ts`. Each file imports
// only the use case port, the response model, the result, the requests of the four game
// use cases (the undo and the redo since #178), three values of the domain, the state mapper
// and the text catalog. The third value is the `LevelId` that `onStart()` passes
// to `StartGame` (issue #172). It holds no name of a variant
// class (a name that starts with `Lines`, `Fit`, `Sort` or `Merge`) and no text of a variant
// id, such as `'hexa-lines'`.

const files = ['src/adapters/game-presenter.ts', 'src/adapters/state-mapper.ts'];

const ALLOWED_IMPORTS = new Set([
  '../application/apply-move',
  '../application/move-result',
  '../application/redo-move',
  '../application/result',
  '../application/start-game',
  '../application/undo-move',
  '../application/use-case',
  '../domain/engine/outcome',
  '../domain/progress/level-id',
  '../domain/shared/score',
  './state-mapper',
  './texts/text-catalog',
]);

const VARIANT_NAME = /^(Lines|Fit|Sort|Merge)/;
const VARIANT_ID = /hexa-[a-z]/;

// Each name of a variant, text of a variant id and import that is not allowed in one source.
function problemsIn(text: string): string[] {
  const file = ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const from = node.moduleSpecifier.text;
      if (!ALLOWED_IMPORTS.has(from)) problems.push(`import: ${from}`);
    } else if (
      ts.isStringLiteralLike(node) &&
      !ts.isImportDeclaration(node.parent) &&
      VARIANT_ID.test(node.text)
    ) {
      problems.push(`id: ${node.text}`);
    }
    if (ts.isIdentifier(node) && VARIANT_NAME.test(node.text)) problems.push(`name: ${node.text}`);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}

describe('GamePresenter gate', () => {
  it('should_find_no_variant_name_no_variant_id_and_no_other_import_when_the_presenter_is_read', () => {
    expect(
      files.flatMap((file) => problemsIn(readFileSync(path.join(repoRoot, file), 'utf8'))),
    ).toEqual([]);
  });

  it('should_report_each_variant_name_id_and_import_when_a_presenter_names_a_variant', () => {
    const source = [
      "import { LinesState } from '../domain/variants/hexa-lines/lines-state';",
      'export class Wrong {',
      '  view(fit: FitView) {',
      "    return this.gameId === 'hexa-merge' ? 'Sort' : fit;",
      '  }',
      '}',
    ].join('\n');

    expect(problemsIn(source)).toEqual([
      'import: ../domain/variants/hexa-lines/lines-state',
      'name: LinesState',
      'name: FitView',
      'id: hexa-merge',
    ]);
  });
});
