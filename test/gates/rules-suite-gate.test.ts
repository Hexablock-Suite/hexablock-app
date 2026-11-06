/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-12 (issue 102): each variant has one rules suite, and no test replaces
// an engine or variant class with a double. Doubles replace only the boundaries,
// the interfaces that an outer layer implements (`Clock`, `RandomSource`, `GameEventPublisher`).
//
// Naming: the variant folder `src/domain/variants/hexa-<name>/` has its rules suite at
// `test/domain/variants/hexa-<name>/<name>-rules.test.ts`, next to `<name>-rules.ts`.
// A folder without the `hexa-` prefix uses its whole name.
//
// Each check takes a repository root, so the fixtures in `test/fixtures/rules-suite/` prove that it fails.

const fixtures = path.join(repoRoot, 'test/fixtures/rules-suite');

// The variant contract is an interface, but a double of it replaces a variant class.
const CONTRACT_INTERFACES = ['IGameRules'];
// A test or a test helper that a variant suite reads may not double these layers.
const PROTECTED_SOURCES = ['src/domain/engine', 'src/domain/variants'];
const SCANNED_TESTS = ['test/domain/variants', 'test/support/variants'];
const MOCK_CALLS = ['mock', 'doMock', 'unstable_mockModule'];

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

// Lists the files under `dir` whose name matches `pattern`, at any depth.
function filesUnder(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => pattern.test(file))
    .map((file) => path.join(dir, file))
    .sort();
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function visit(node: ts.Node, onNode: (node: ts.Node) => void): void {
  onNode(node);
  ts.forEachChild(node, (child) => visit(child, onNode));
}

function variantFolders(root: string): string[] {
  const variants = path.join(root, 'src/domain/variants');
  return readdirSync(variants, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function rulesSuitePath(variant: string): string {
  return `test/domain/variants/${variant}/${variant.replace(/^hexa-/, '')}-rules.test.ts`;
}

function missingRulesSuites(root: string): string[] {
  return variantFolders(root)
    .filter((variant) => !existsSync(path.join(root, rulesSuitePath(variant))))
    .map((variant) => `${variant}: no rules suite at ${rulesSuitePath(variant)}`);
}

// The names of the classes that the engine and the variants export, plus the variant contract.
function protectedClasses(root: string): Set<string> {
  const names = new Set(CONTRACT_INTERFACES);
  for (const source of PROTECTED_SOURCES) {
    for (const file of filesUnder(path.join(root, source), /\.tsx?$/)) {
      visit(parse(file), (node) => {
        if (ts.isClassDeclaration(node) && node.name) names.add(node.name.text);
      });
    }
  }
  return names;
}

// Resolves a relative or `@/` module path to a repository path without an extension.
function modulePath(root: string, file: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith('.')) return null;
  return toPosix(path.relative(root, path.resolve(path.dirname(file), specifier)));
}

function isProtectedModule(target: string | null): boolean {
  if (target === null) return false;
  return PROTECTED_SOURCES.some((source) => target === source || target.startsWith(`${source}/`));
}

// The name of a heritage type: `LinesRules` for `LinesRules<T>` and for `variants.LinesRules`.
function heritageName(expression: ts.Expression): string {
  return ts.isPropertyAccessExpression(expression) ? expression.name.text : expression.getText();
}

function doublesIn(root: string, file: string, classes: Set<string>): string[] {
  const relative = toPosix(path.relative(root, file));
  const found: string[] = [];
  visit(parse(file), (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === 'jest' &&
      MOCK_CALLS.includes(node.expression.name.text) &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const target = modulePath(root, file, node.arguments[0].text);
      if (isProtectedModule(target)) {
        found.push(`${relative}: jest.${node.expression.name.text} replaces ${target}`);
      }
    }
    if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.heritageClauses) {
      const name = node.name?.text ?? '(anonymous)';
      for (const clause of node.heritageClauses) {
        const keyword = clause.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements';
        for (const type of clause.types) {
          const parent = heritageName(type.expression);
          if (classes.has(parent)) found.push(`${relative}: class ${name} ${keyword} ${parent}`);
        }
      }
    }
  });
  return found;
}

function scannedTestFiles(root: string): string[] {
  return SCANNED_TESTS.flatMap((dir) => filesUnder(path.join(root, dir), /\.tsx?$/));
}

function engineDoubles(root: string): string[] {
  const classes = protectedClasses(root);
  return scannedTestFiles(root).flatMap((file) => doublesIn(root, file, classes));
}

describe('rules suite gate (APP-NFR-12)', () => {
  it('should_report_the_variant_when_it_has_no_rules_suite', () => {
    expect(missingRulesSuites(path.join(fixtures, 'missing-suite'))).toEqual([
      'hexa-fit: no rules suite at test/domain/variants/hexa-fit/fit-rules.test.ts',
    ]);
  });

  it('should_report_each_double_when_a_test_replaces_an_engine_or_variant_class', () => {
    expect(engineDoubles(path.join(fixtures, 'engine-double'))).toEqual([
      'test/domain/variants/hexa-lines/lines-rules.test.ts: jest.mock replaces src/domain/engine/rules',
      'test/domain/variants/hexa-lines/lines-rules.test.ts: jest.mock replaces src/domain/variants/hexa-lines/lines-rules',
      'test/domain/variants/hexa-lines/lines-rules.test.ts: class StubRules extends BaseGameRules',
      'test/domain/variants/hexa-lines/lines-rules.test.ts: class HandRules implements IGameRules',
      'test/domain/variants/hexa-lines/lines-rules.test.ts: class FakeLines extends LinesRules',
      'test/support/variants/hexa-lines/lines-game.ts: jest.doMock replaces src/domain/engine/rules',
      'test/support/variants/hexa-lines/lines-game.ts: class (anonymous) extends LinesRules',
    ]);
  });

  it('should_find_a_rules_suite_for_each_variant_when_the_real_tree_is_read', () => {
    expect(variantFolders(repoRoot)).toContain('hexa-lines');
    expect(missingRulesSuites(repoRoot)).toEqual([]);
  });

  it('should_find_no_double_of_an_engine_or_variant_class_when_the_real_tree_is_read', () => {
    expect(scannedTestFiles(repoRoot)).toContain(path.join(repoRoot, rulesSuitePath('hexa-lines')));
    expect(engineDoubles(repoRoot)).toEqual([]);
  });
});
