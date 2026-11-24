/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-FR-11 (issues #154 and #320): a screen in `app/` and a shared view in
// `src/infrastructure/` show each text through a key of the text catalog in
// `src/adapters/texts/`, never through a literal text in their JSX.

const appDir = path.join(repoRoot, 'app');
const infrastructureDir = path.join(repoRoot, 'src/infrastructure');
const fixtureDir = path.join(repoRoot, 'test/fixtures/jsx-text');

// The props that a person reads or hears: a title, a label, the label and the hint of
// the screen reader, and the placeholder of an input. Another prop, such as `look` or
// `testID`, holds no visible text.
const TEXT_PROPS = new Set([
  'title',
  'label',
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
]);

// The literal parts of a string or template literal. Another expression gives none.
function expressionParts(value: ts.Expression): string[] {
  if (ts.isStringLiteralLike(value)) return [value.text];
  if (ts.isTemplateExpression(value)) {
    return [value.head.text, ...value.templateSpans.map((span) => span.literal.text)];
  }
  return [];
}

// The literal parts of a JSX child: the text between two tags, or a string or template
// literal in braces, such as `{'Hola'}`. Another child gives no literal part.
function childParts(node: ts.Node): string[] {
  if (ts.isJsxText(node)) return [node.text];
  if (!ts.isJsxExpression(node) || node.expression === undefined) return [];
  if (!ts.isJsxElement(node.parent) && !ts.isJsxFragment(node.parent)) return [];
  return expressionParts(node.expression);
}

// The literal parts of a text prop: `label="Jugar"`, or a string or template literal in
// braces, such as `title={'Pausa'}`. Another prop, or a prop with no value, gives none.
function propParts(node: ts.Node): string[] {
  if (!ts.isJsxAttribute(node) || node.initializer === undefined) return [];
  if (!ts.isIdentifier(node.name) || !TEXT_PROPS.has(node.name.text)) return [];
  const value = node.initializer;
  if (ts.isStringLiteral(value)) return [value.text];
  if (!ts.isJsxExpression(value) || value.expression === undefined) return [];
  return expressionParts(value.expression);
}

function literalParts(node: ts.Node): string[] {
  return [...childParts(node), ...propParts(node)];
}

// Lists each literal text of the JSX in one file, as `<file>:<line> <text>`. A child or a
// prop of only white space, such as `{' '}`, shows no text. The TypeScript parser reads the
// code, so a comment or a string outside the JSX children and the text props never counts.
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

// Reads every `.tsx` and `.jsx` file under `dir`, at any depth. Each file name uses `/`,
// so a report reads the same on Windows.
function scan(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.[jt]sx$/.test(file))
    .map((file) => file.split(path.sep).join('/'))
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

  it('should_report_each_literal_text_prop_when_the_fixture_has_text_in_its_props', () => {
    expect(fixtureTexts('literal-prop.tsx')).toEqual([
      'literal-prop.tsx:15 label="Jugar"',
      "literal-prop.tsx:16 title={'Pausa'}",
      'literal-prop.tsx:17 accessibilityLabel={`Tablero`}',
      'literal-prop.tsx:18 accessibilityHint="Toca una celda"',
      'literal-prop.tsx:19 placeholder={`Nivel ${level}`}',
    ]);
  });

  it('should_report_each_literal_text_when_a_view_of_the_infrastructure_fixture_has_text', () => {
    expect(scan(path.join(fixtureDir, 'infrastructure'))).toEqual([
      'ui/literal-view.tsx:12 Victoria',
      'ui/literal-view.tsx:13 label="Otra vez"',
    ]);
  });

  it('should_report_nothing_when_the_screens_of_app_take_their_texts_from_the_catalog', () => {
    expect(scan(appDir)).toEqual([]);
  });

  it('should_report_nothing_when_the_views_of_the_infrastructure_take_their_texts_from_the_catalog', () => {
    expect(scan(infrastructureDir)).toEqual([]);
  });
});
