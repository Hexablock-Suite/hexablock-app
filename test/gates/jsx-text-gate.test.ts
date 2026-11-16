/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-FR-11 (issue #154): a screen in `app/` shows each text through a key of the text
// catalog in `src/adapters/texts/`, never through a literal text in its JSX.

const appDir = path.join(repoRoot, 'app');
const fixtureDir = path.join(repoRoot, 'test/fixtures/jsx-text');

// The literal parts of a JSX child: the text between two tags, or a string or template
// literal in braces, such as `{'Hola'}`. Another child gives no literal part.
function literalParts(node: ts.Node): string[] {
  if (ts.isJsxText(node)) return [node.text];
  if (!ts.isJsxExpression(node) || node.expression === undefined) return [];
  if (!ts.isJsxElement(node.parent) && !ts.isJsxFragment(node.parent)) return [];
  const value = node.expression;
  if (ts.isStringLiteralLike(value)) return [value.text];
  if (ts.isTemplateExpression(value)) {
    return [value.head.text, ...value.templateSpans.map((span) => span.literal.text)];
  }
  return [];
}

// Lists each literal text of the JSX in one file, as `<file>:<line> <text>`. A child of
// only white space, such as `{' '}`, shows no text. The TypeScript parser reads the code,
// so a comment or a string outside the JSX children never counts.
function literalTexts(source: string, fileName: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (literalParts(node).some((part) => part.trim() !== '')) {
      const text = node.getText(file);
      const start = node.getStart(file) + text.length - text.trimStart().length;
      const line = file.getLineAndCharacterOfPosition(start).line + 1;
      found.push(`${fileName}:${line} ${text.trim().replace(/\s+/g, ' ')}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

// Reads every `.tsx` and `.jsx` file under `dir`, at any depth.
function scan(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.[jt]sx$/.test(file))
    .sort()
    .flatMap((file) => literalTexts(readFileSync(path.join(dir, file), 'utf8'), file));
}

function fixtureTexts(name: string): string[] {
  return literalTexts(readFileSync(path.join(fixtureDir, name), 'utf8'), name);
}

describe('JSX literal text gate', () => {
  it('should_report_each_literal_text_when_the_fixture_has_text_in_its_jsx', () => {
    expect(fixtureTexts('literal-text.tsx')).toEqual([
      'literal-text.tsx:7 Hola',
      'literal-text.tsx:9 Adiós',
      "literal-text.tsx:11 {'Jugar'}",
      'literal-text.tsx:12 {`Salir`}',
      'literal-text.tsx:13 {`Puntos: ${score}`}',
      'literal-text.tsx:14 Fin',
    ]);
  });

  it('should_report_nothing_when_the_fixture_shows_only_values_and_white_space', () => {
    expect(fixtureTexts('clean.tsx')).toEqual([]);
  });

  it('should_report_nothing_when_the_screens_of_app_take_their_texts_from_the_catalog', () => {
    expect(scan(appDir)).toEqual([]);
  });
});
