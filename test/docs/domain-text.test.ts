/** @jest-environment node */
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';
import { domainDir, domainSources } from './domain-source';

// Issue #237: a domain object gives no text. A value object delivers its value to a receiver
// with `deliverTo(receiver)`, and no operation returns the value, `toString()` included
// (rule R-no-delivery-call). An error that names a value carries the object as its `cause`,
// and the edge delivers its text.
// JavaScript calls `toString()` when a template literal, `String()`, a `+` with a text
// or `join()` meets an object. Without `toString()`, the text is `[object Object]`,
// and the compiler accepts it. So the scan reads every `.ts` file under `src/domain/`
// and asks the TypeScript checker for the type of each such value. It reports:
// - a class that declares a `toString` member;
// - a span of a template literal whose value is an object;
// - a call of `String()` whose argument is an object;
// - a `+` or a `+=` with a text on one side and an object on the other side;
// - a call of `join()` on a list of objects.
// A text, a number, a boolean, a bigint, a symbol, `null` and `undefined` are not objects.
// A branded text, such as `CoordKey`, is a text. A type parameter is an object
// when its bound is an object.
// The scan does not report `unknown` and `any`: the code that holds them names any value.
// It reports `never`: such a value reaches the line only through a cast,
// so at runtime it can be a domain object.

type Finding = string;

// A program over the given files, so the checker knows the type of each value.
function programOf(files: Record<string, string>): ts.Program {
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.Latest };
  const host = ts.createCompilerHost(options, true);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (file) => file in files || fileExists(file);
  host.readFile = (file) => files[file] ?? readFile(file);
  host.getSourceFile = (file, language, ...rest) => {
    const text = files[file];
    if (text === undefined) return getSourceFile(file, language, ...rest);
    return ts.createSourceFile(file, text, language, true);
  };
  return ts.createProgram(Object.keys(files), options, host);
}

const notObjects =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.BigIntLike |
  ts.TypeFlags.ESSymbolLike |
  ts.TypeFlags.Null |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Void |
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown;

// True when a value of `type` can be an object at runtime.
function isObject(type: ts.Type): boolean {
  const flags = type.getFlags();
  if (type.isUnion()) return type.types.some(isObject);
  // A branded text, such as `string & { brand }`, holds a primitive part.
  if (type.isIntersection()) return type.types.every(isObject);
  if (flags & ts.TypeFlags.TypeParameter) {
    const bound = type.getConstraint();
    return bound !== undefined && isObject(bound);
  }
  if (flags & ts.TypeFlags.Never) return true;
  return (flags & notObjects) === 0;
}

// True when a value of `type` is a text, a branded text included.
function isText(type: ts.Type): boolean {
  if (type.isIntersection()) return type.types.some(isText);
  return (type.getFlags() & ts.TypeFlags.StringLike) !== 0;
}

// The findings of one source file, each as `path:line what`.
function findingsIn(source: ts.SourceFile, checker: ts.TypeChecker): Finding[] {
  const found: Finding[] = [];
  const report = (node: ts.Node, what: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push(`${path.relative(repoRoot, source.fileName)}:${line + 1} ${what}`);
  };
  const objectAt = (node: ts.Expression) => isObject(checker.getTypeAtLocation(node));
  const visit = (node: ts.Node): void => {
    if (ts.isClassLike(node)) {
      for (const member of node.members) {
        if (member.name?.getText(source) === 'toString') report(member, 'declares toString');
      }
    }
    if (
      ts.isTemplateSpan(node) &&
      !ts.isTaggedTemplateExpression(node.parent.parent) &&
      objectAt(node.expression)
    ) {
      report(node, 'template literal of an object');
    }
    if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      if (ts.isIdentifier(node.expression) && node.expression.text === 'String') {
        if (first !== undefined && objectAt(first)) report(node, 'String() of an object');
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join') {
        const list = checker.getTypeAtLocation(node.expression.expression);
        const item = checker.getIndexTypeOfType(list, ts.IndexKind.Number);
        if (item !== undefined && isObject(item)) report(node, 'join() of objects');
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.PlusToken ||
        node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)
    ) {
      const left = checker.getTypeAtLocation(node.left);
      const right = checker.getTypeAtLocation(node.right);
      if ((isText(left) && isObject(right)) || (isText(right) && isObject(left))) {
        report(node, '+ of a text and an object');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// The findings in a set of source files, each named by its path.
function scan(files: Record<string, string>): Finding[] {
  const program = programOf(files);
  const checker = program.getTypeChecker();
  return Object.keys(files).flatMap((file) => {
    const source = program.getSourceFile(file);
    if (source === undefined) throw new Error(`The program has no file ${file}.`);
    return findingsIn(source, checker);
  });
}

// A source file at a place under `src/domain/`. The file exists only in the program of the test.
const fixturePath = path.join(domainDir, 'engine', 'fixture-text.ts');
const fixture = (lines: string[]) => scan({ [fixturePath]: lines.join('\n') });
const at = (line: number, what: string) =>
  `${path.relative(repoRoot, fixturePath)}:${line} ${what}`;

describe('domain text gate', () => {
  it('should_find_no_to_string_and_no_text_of_a_domain_object_when_the_domain_is_scanned', () => {
    expect(scan(domainSources())).toEqual([]);
  });

  it('should_report_the_class_when_a_class_declares_to_string', () => {
    const findings = fixture([
      'export class Named {',
      '  private constructor(private readonly name: string) {}',
      '  toString(): string {',
      '    return this.name;',
      '  }',
      '}',
    ]);

    expect(findings).toEqual([at(3, 'declares toString')]);
  });

  it('should_report_each_conversion_when_a_text_is_built_from_a_domain_object', () => {
    const findings = fixture([
      'class Id {',
      '  equals(other: Id): boolean {',
      '    return this === other;',
      '  }',
      '}',
      'export function texts(id: Id, ids: readonly Id[], maybe: Id | undefined): string[] {',
      '  let joined = "id ";',
      '  joined += id;',
      '  return [`id ${id}`, String(maybe), "id " + id, ids.join(), joined];',
      '}',
    ]);

    expect(findings).toEqual([
      at(8, '+ of a text and an object'),
      at(9, 'template literal of an object'),
      at(9, 'String() of an object'),
      at(9, '+ of a text and an object'),
      at(9, 'join() of objects'),
    ]);
  });

  it('should_report_the_value_when_a_cast_value_of_type_never_is_converted', () => {
    const findings = fixture([
      'class Axis {}',
      'export function check(axis: Axis): void {',
      '  if (!(axis instanceof Axis)) throw new RangeError(`No axis ${String(axis)}.`);',
      '}',
    ]);

    expect(findings).toEqual([at(3, 'String() of an object')]);
  });

  it('should_pass_the_text_when_a_template_literal_holds_numbers_texts_and_branded_keys', () => {
    const findings = fixture([
      'declare const brand: unique symbol;',
      'type Key = string & { readonly [brand]: true };',
      'export function texts(count: number, name: string, key: Key, keys: Key[], any: unknown) {',
      '  return [`${count} ${name} ${key}`, String(any), "key " + key, keys.join(), `${true}`];',
      '}',
      'export function tagged(id: object): string {',
      '  return tag`id ${id}`;',
      '}',
      'function tag(parts: TemplateStringsArray, ...values: unknown[]): string {',
      '  return parts.join(String(values.length));',
      '}',
    ]);

    expect(findings).toEqual([]);
  });
});
