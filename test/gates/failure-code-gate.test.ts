/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { FailureCode } from '../../src/application/result';
import { repoRoot } from '../support/run-tool';

// Issue #322: a use case builds each failure from `FailureCode` (classes.md decision 62).
// `result.ts` holds the one list of codes. No other file of `src/application/` writes
// the text of a code as a string literal. So a typo cannot reach the presenter.

const APPLICATION = path.join(repoRoot, 'src', 'application');
const HOME = path.join(APPLICATION, 'result.ts');
const CODES = new Set<string>(Object.values(FailureCode));

// Every `.ts` file under one folder and its subfolders.
function sourcesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourcesUnder(at);
    return entry.name.endsWith('.ts') ? [at] : [];
  });
}

// Each string literal of one source whose text is a failure code, as `<line>: <code>`.
function codeLiteralsIn(text: string): string[] {
  const file = ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) && CODES.has(node.text)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push(`${line}: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('failure code gate', () => {
  it('should_find_no_failure_code_literal_when_the_use_cases_are_read', () => {
    const found = sourcesUnder(APPLICATION)
      .filter((source) => source !== HOME)
      .flatMap((source) =>
        codeLiteralsIn(readFileSync(source, 'utf8')).map(
          (hit) => `${path.relative(repoRoot, source)}:${hit}`,
        ),
      );

    expect(found).toEqual([]);
  });

  it('should_report_each_code_literal_when_a_use_case_writes_one', () => {
    const source = [
      "const NAMED = 'unexpected-failure';",
      '// A comment may name no-running-game.',
      "new UseCaseError('no-running-game', 'No game is running.');",
      'caughtError(`move-failed`, thrown);',
      "new UseCaseError(FailureCode.moveRejected, 'The rules rejected the move.');",
    ].join('\n');

    expect(codeLiteralsIn(source)).toEqual([
      '1: unexpected-failure',
      '3: no-running-game',
      '4: move-failed',
    ]);
  });
});
