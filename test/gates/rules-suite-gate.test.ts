/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-12 (issue 102): each variant has one rules suite, and no test replaces
// an engine or variant class with a double. Doubles replace only the boundaries,
// the interfaces that an outer layer implements (`Clock`, `RandomSource`, `GameEventPublisher`).
// The scoring is the one accepted exception: a rules suite may pass an `IScoringPolicy`
// double, because the scoring of each variant has its own suites (gap G113.2).
//
// A double is one of these forms (issue 124, gaps G113.1 and G113.3):
// - `jest.mock`, `jest.doMock` or `jest.unstable_mockModule` of an engine or variant module.
//   The path is a string literal, a template literal without `${…}`, or a `const` that holds one.
//   The gate reports every other path, because it cannot resolve it.
// - `jest.spyOn` on an engine or variant class or on its prototype.
// - a class that extends or implements `IGameRules` or an engine or variant class.
// - an object literal typed `IGameRules` by an annotation, `satisfies` or a cast.
// A spy on an instance, such as `jest.spyOn(rules, 'apply')`, is not caught.
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

function parse(file: string, text = readFileSync(file, 'utf8')): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
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

// A call `jest.<method>(…)`, where `method` is one of `methods`.
function jestCall(
  node: ts.Node,
  methods: string[],
): node is ts.CallExpression & {
  expression: ts.PropertyAccessExpression;
} {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === 'jest' &&
    methods.includes(node.expression.name.text)
  );
}

// The `const` declarations of the file that hold a string literal or a template literal
// without `${…}`. A name that the file declares twice has no value, so the gate reports it.
function constantPaths(source: ts.SourceFile): Map<string, string | null> {
  const values = new Map<string, string | null>();
  visit(source, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return;
    const isConst = (ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const) !== 0;
    const value =
      isConst && node.initializer !== undefined && ts.isStringLiteralLike(node.initializer)
        ? node.initializer.text
        : null;
    values.set(node.name.text, values.has(node.name.text) ? null : value);
  });
  return values;
}

// The text of a mock path: a string literal, a template literal without `${…}`,
// or a `const` that holds one of them. Any other expression gives `null`.
function mockPath(argument: ts.Expression, constants: Map<string, string | null>): string | null {
  if (ts.isStringLiteralLike(argument)) return argument.text;
  if (ts.isIdentifier(argument)) return constants.get(argument.text) ?? null;
  return null;
}

// The protected class that a `jest.spyOn` target names: `LinesRules`,
// `LinesRules.prototype` or `variants.LinesRules.prototype`.
function spiedClass(target: ts.Expression, classes: Set<string>): string | null {
  const isPrototype = ts.isPropertyAccessExpression(target) && target.name.text === 'prototype';
  const owner = isPrototype ? target.expression : target;
  if (!ts.isIdentifier(owner) && !ts.isPropertyAccessExpression(owner)) return null;
  const name = heritageName(owner);
  if (!classes.has(name)) return null;
  return isPrototype ? `${name}.prototype` : name;
}

// The contract interface that the type node names at any depth, as in `Partial<IGameRules<…>>`.
function contractIn(type: ts.TypeNode): string | null {
  let found: string | null = null;
  visit(type, (node) => {
    if (ts.isTypeReferenceNode(node)) {
      const name = ts.isQualifiedName(node.typeName) ? node.typeName.right : node.typeName;
      if (CONTRACT_INTERFACES.includes(name.text)) found = name.text;
    }
  });
  return found;
}

// The object literal under parentheses and `as` or `satisfies` wrappers, if any.
function objectLiteral(expression: ts.Expression): ts.ObjectLiteralExpression | null {
  let inner = expression;
  while (
    ts.isParenthesizedExpression(inner) ||
    ts.isAsExpression(inner) ||
    ts.isSatisfiesExpression(inner) ||
    ts.isTypeAssertionExpression(inner)
  ) {
    inner = inner.expression;
  }
  return ts.isObjectLiteralExpression(inner) ? inner : null;
}

// An object literal that gets a contract type through an annotation, `satisfies` or a cast,
// for example `object literal typed IGameRules (satisfies)`.
function contractLiteral(node: ts.Node): string | null {
  if (
    (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isParameter(node)) &&
    node.type !== undefined &&
    node.initializer !== undefined &&
    objectLiteral(node.initializer) !== null
  ) {
    const contract = contractIn(node.type);
    if (contract !== null) return `object literal typed ${contract} (annotation)`;
  }
  if (
    (ts.isSatisfiesExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node)) &&
    objectLiteral(node.expression) !== null
  ) {
    const contract = contractIn(node.type);
    const how = ts.isSatisfiesExpression(node) ? 'satisfies' : 'as';
    if (contract !== null) return `object literal typed ${contract} (${how})`;
  }
  return null;
}

// Reads the doubles in the source text of `file`. `text` defaults to the file content.
function doublesIn(root: string, file: string, classes: Set<string>, text?: string): string[] {
  const relative = toPosix(path.relative(root, file));
  const found: string[] = [];
  const source = parse(file, text);
  const constants = constantPaths(source);
  visit(source, (node) => {
    if (jestCall(node, MOCK_CALLS) && node.arguments[0] !== undefined) {
      const call = `jest.${node.expression.name.text}`;
      const specifier = mockPath(node.arguments[0], constants);
      if (specifier === null) {
        found.push(
          `${relative}: ${call} path is not a string literal: ${node.arguments[0].getText()}`,
        );
      } else {
        const target = modulePath(root, file, specifier);
        if (isProtectedModule(target)) found.push(`${relative}: ${call} replaces ${target}`);
      }
    }
    if (jestCall(node, ['spyOn']) && node.arguments[0] !== undefined) {
      const spied = spiedClass(node.arguments[0], classes);
      if (spied !== null) found.push(`${relative}: jest.spyOn on ${spied}`);
    }
    const literal = contractLiteral(node);
    if (literal !== null) found.push(`${relative}: ${literal}`);
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

  it('should_use_the_whole_folder_name_when_a_variant_folder_has_no_hexa_prefix', () => {
    const root = path.join(fixtures, 'unprefixed-folder');

    expect(variantFolders(root)).toEqual(['octo', 'tetra']);
    expect(missingRulesSuites(root)).toEqual([
      'octo: no rules suite at test/domain/variants/octo/octo-rules.test.ts',
    ]);
  });

  describe('mock paths (gap G113.3)', () => {
    const suite = path.join(repoRoot, rulesSuitePath('hexa-lines'));
    const label = rulesSuitePath('hexa-lines');
    const scan = (lines: string[]) =>
      doublesIn(repoRoot, suite, protectedClasses(repoRoot), lines.join('\n'));

    it('should_report_the_resolved_path_when_a_mock_path_is_a_const_with_a_string_literal', () => {
      const found = scan([
        "const RULES = '../../../../src/domain/engine/rules';",
        'const LINES = `@/domain/variants/hexa-lines/lines-rules`;',
        "const FS = 'node:fs';",
        'jest.mock(RULES);',
        'jest.doMock(LINES);',
        'jest.mock(FS);',
      ]);

      expect(found).toEqual([
        `${label}: jest.mock replaces src/domain/engine/rules`,
        `${label}: jest.doMock replaces src/domain/variants/hexa-lines/lines-rules`,
      ]);
    });

    it('should_report_the_resolved_path_when_a_mock_path_is_a_template_literal_without_substitutions', () => {
      const found = scan([
        'jest.unstable_mockModule(`@/domain/variants/hexa-lines/lines-rules`, () => ({}));',
        'jest.mock(`node:fs`);',
      ]);

      expect(found).toEqual([
        `${label}: jest.unstable_mockModule replaces src/domain/variants/hexa-lines/lines-rules`,
      ]);
    });

    it('should_report_the_mock_call_when_its_path_is_not_a_string_literal', () => {
      const found = scan([
        "const ROOT = '@/domain/engine';",
        "let rules = '@/domain/engine/rules';",
        'jest.mock(`${ROOT}/rules`);',
        "jest.doMock('@/domain/' + 'engine/rules');",
        'jest.mock(rules);',
        'jest.mock(UNKNOWN);',
        "jest.unstable_mockModule(path.join('a', 'b'), () => ({}));",
      ]);

      expect(found).toEqual([
        `${label}: jest.mock path is not a string literal: \`\${ROOT}/rules\``,
        `${label}: jest.doMock path is not a string literal: '@/domain/' + 'engine/rules'`,
        `${label}: jest.mock path is not a string literal: rules`,
        `${label}: jest.mock path is not a string literal: UNKNOWN`,
        `${label}: jest.unstable_mockModule path is not a string literal: path.join('a', 'b')`,
      ]);
    });

    // Issue 136: the gate cannot tell which declaration a mock call reads, so it keeps no value.
    // A gate that keeps the last value reads `node:fs` here and misses the engine double.
    it('should_report_the_mock_call_when_the_file_declares_its_path_const_twice', () => {
      const found = scan([
        "const RULES = '@/domain/engine/rules';",
        'jest.mock(RULES);',
        'function unrelated(): string {',
        "  const RULES = 'node:fs';",
        '  return RULES;',
        '}',
      ]);

      expect(found).toEqual([`${label}: jest.mock path is not a string literal: RULES`]);
    });
  });

  describe('spies and literal doubles (gap G113.1)', () => {
    const suite = path.join(repoRoot, rulesSuitePath('hexa-lines'));
    const label = rulesSuitePath('hexa-lines');
    const scan = (lines: string[]) =>
      doublesIn(repoRoot, suite, protectedClasses(repoRoot), lines.join('\n'));

    it('should_report_the_spy_when_a_test_spies_on_an_engine_or_variant_class_or_its_prototype', () => {
      const found = scan([
        "jest.spyOn(LinesRules.prototype, 'apply');",
        "jest.spyOn(BaseGameRules.prototype, 'playTurn');",
        "jest.spyOn(Slide, 'of');",
        "jest.spyOn(variants.LinesRules.prototype, 'isValid');",
        "jest.spyOn(clock, 'now');",
        "jest.spyOn(Math, 'random');",
        "jest.spyOn(FixedClock.prototype, 'now');",
      ]);

      expect(found).toEqual([
        `${label}: jest.spyOn on LinesRules.prototype`,
        `${label}: jest.spyOn on BaseGameRules.prototype`,
        `${label}: jest.spyOn on Slide`,
        `${label}: jest.spyOn on LinesRules.prototype`,
      ]);
    });

    it('should_report_the_literal_when_an_object_literal_is_typed_as_the_rules_contract', () => {
      const found = scan([
        'const annotated: IGameRules<Move, State> = { apply: () => state };',
        'const checked = { apply: () => state } satisfies IGameRules<Move, State>;',
        'const cast = { apply: () => state } as IGameRules<Move, State>;',
        'const twice = ({ apply: () => state } as unknown) as engine.IGameRules<Move, State>;',
        'const angled = <IGameRules<Move, State>>{ apply: () => state };',
        'const partial: Partial<IGameRules<Move, State>> = { apply: () => state };',
        'const real: IGameRules<Move, State> = new LinesRules();',
        'const clock: Clock = { now: () => 0 };',
        'const free = { now: () => 0 } satisfies Clock;',
      ]);

      expect(found).toEqual([
        `${label}: object literal typed IGameRules (annotation)`,
        `${label}: object literal typed IGameRules (satisfies)`,
        `${label}: object literal typed IGameRules (as)`,
        `${label}: object literal typed IGameRules (as)`,
        `${label}: object literal typed IGameRules (as)`,
        `${label}: object literal typed IGameRules (annotation)`,
      ]);
    });
  });

  // Issue 102 scope: engine tests need fake subclasses of `BaseGameRules`, so the gate skips them.
  it('should_report_no_double_when_the_double_is_in_an_engine_test_outside_the_variant_folders', () => {
    const root = path.join(fixtures, 'engine-test-out-of-scope');

    expect(scannedTestFiles(root)).toEqual([
      path.join(root, 'test/domain/variants/hexa-lines/lines-rules.test.ts'),
    ]);
    expect(engineDoubles(root)).toEqual([]);
  });
});
