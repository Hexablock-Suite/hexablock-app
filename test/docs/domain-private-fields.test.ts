/** @jest-environment node */
import path from 'node:path';
import ts from 'typescript';

import { fieldBaseline, type FieldEntry } from './domain-baseline';
import {
  domainDir,
  domainSources,
  exportedTypes,
  hasModifier,
  isPrivate,
  nameOf,
} from './domain-source';

// Rule R-domain-private-fields (issue #231): every attribute of a class of `src/domain/` is private,
// and no class has a getter (class of 2026-11-09, design decisions of 2026-11-12 and 2026-11-15).
// The gate reads the exported classes and interfaces of every `.ts` file under `src/domain/`.
// The field rule fails on a field that is not private: a public field, a public `readonly` field,
// a `protected` field, a public or `protected` parameter property, and a property of an interface.
// A field with the `private` modifier or a `#` name passes.
// A `static readonly` field passes: it is a constant of the class, such as an instance of
// a closed set (classes.md decision 45), not an attribute of an object.
// The get rule fails on a `get` accessor, on a method named `get`, and on a method whose name
// is `get` followed by an upper-case letter, such as `getScore()`. A private member passes.
// Only an entry of the baseline list (`domain-baseline.ts`) excuses a break, and each entry
// names the issue that removes it.

type Rule = 'field' | 'get';
type FieldBreak = { rule: Rule; where: string };

const key = (found: FieldBreak) => `${found.rule} ${found.where}`;

// A method named `get`, or `get` followed by an upper-case letter.
const getterName = /^get($|[A-Z])/;

// The fields of a constructor that are not private: its parameter properties without `private`.
function constructorBreaks(owner: string, ctor: ts.ConstructorDeclaration): FieldBreak[] {
  return ctor.parameters
    .filter((parameter) => ts.isParameterPropertyDeclaration(parameter, ctor))
    .filter((parameter) => !isPrivate(parameter))
    .map((parameter) => ({ rule: 'field', where: `${owner}.${nameOf(parameter)}` }));
}

function memberBreaks(owner: string, member: ts.Node): FieldBreak[] {
  // A private constructor can still declare a public parameter property.
  if (ts.isConstructorDeclaration(member)) return constructorBreaks(owner, member);
  if (isPrivate(member)) return [];
  const where = `${owner}.${nameOf(member as ts.NamedDeclaration)}`;
  if (ts.isPropertyDeclaration(member)) {
    const constant =
      hasModifier(member, ts.SyntaxKind.StaticKeyword) &&
      hasModifier(member, ts.SyntaxKind.ReadonlyKeyword);
    return constant ? [] : [{ rule: 'field', where }];
  }
  if (ts.isPropertySignature(member)) return [{ rule: 'field', where }];
  if (ts.isGetAccessor(member)) return [{ rule: 'get', where }];
  const method = ts.isMethodDeclaration(member) || ts.isMethodSignature(member);
  return method && getterName.test(nameOf(member)) ? [{ rule: 'get', where }] : [];
}

// The breaks in a set of source files, each named by its path. Each place is listed once.
function fieldBreaksIn(files: Record<string, string>): FieldBreak[] {
  const breaks = Object.entries(files).flatMap(([file, text]) =>
    exportedTypes(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)).flatMap((type) =>
      (type.members as readonly ts.Node[]).flatMap((member) =>
        memberBreaks(type.name?.text ?? 'default', member),
      ),
    ),
  );
  return [...new Map(breaks.map((found) => [key(found), found])).values()];
}

// The scan of `src/domain/` is the same for every test, so it runs once.
let domainBreaks: FieldBreak[] | undefined;
function codeBreaks(): FieldBreak[] {
  domainBreaks ??= fieldBreaksIn(domainSources());
  return domainBreaks;
}

function unexcused(breaks: FieldBreak[], baseline: readonly FieldEntry[]): FieldBreak[] {
  const excused = new Set(baseline.map(key));
  return breaks.filter((found) => !excused.has(key(found)));
}

const fixture = (source: string) => ({ [path.join(domainDir, 'engine/fixture.ts')]: source });

describe('private fields of the domain', () => {
  it('should_fail_the_field_gate_when_a_field_is_not_private', () => {
    const source = [
      'export class Ledger {',
      '  total: Score;',
      '  readonly owner: Owner;',
      '  protected kept: Score;',
      '  static count: Count;',
      '  constructor(public readonly first: Score, protected second: Score, readonly third: Score) {}',
      '}',
      'export interface LedgerPhoto {',
      '  readonly total: Score;',
      '  balance: Score;',
      '}',
    ].join('\n');

    expect(fieldBreaksIn(fixture(source))).toEqual([
      { rule: 'field', where: 'Ledger.total' },
      { rule: 'field', where: 'Ledger.owner' },
      { rule: 'field', where: 'Ledger.kept' },
      { rule: 'field', where: 'Ledger.count' },
      { rule: 'field', where: 'Ledger.first' },
      { rule: 'field', where: 'Ledger.second' },
      { rule: 'field', where: 'Ledger.third' },
      { rule: 'field', where: 'LedgerPhoto.total' },
      { rule: 'field', where: 'LedgerPhoto.balance' },
    ]);
  });

  it('should_pass_the_field_gate_when_a_field_is_private', () => {
    const source = [
      'export class Vault {',
      '  private total: Score;',
      '  private readonly owner: Owner;',
      '  #code: Code;',
      '  private static readonly byName = new Map();',
      '  private constructor(private readonly first: Score) {}',
      '}',
      'class Hidden {',
      '  readonly open: Score;',
      '}',
    ].join('\n');

    expect(fieldBreaksIn(fixture(source))).toEqual([]);
  });

  // A `static readonly` field is a constant of the class, such as an instance of a closed set
  // (classes.md decision 45). It is not an attribute of an object.
  it('should_pass_the_field_gate_when_a_static_readonly_field_holds_an_instance_of_a_closed_set', () => {
    const source = [
      'export class Phase {',
      "  static readonly playing = new Phase('playing');",
      '  private constructor(private readonly name: string) {}',
      '}',
    ].join('\n');

    expect(fieldBreaksIn(fixture(source))).toEqual([]);
  });

  it('should_fail_the_get_gate_when_a_member_is_a_get_accessor_or_a_get_method', () => {
    const source = [
      'export class Board {',
      '  get size(): Count {',
      '    return this.count;',
      '  }',
      '  get(at: Coord): Cell {',
      '    return this.cell;',
      '  }',
      '  getScore(): Score {',
      '    return this.score;',
      '  }',
      '  getaway(): void {}',
      '  target(): Coord {',
      '    return this.at;',
      '  }',
      '  private getHidden(): Cell {',
      '    return this.cell;',
      '  }',
      '}',
      'export interface ReadonlyBoard {',
      '  get(at: Coord): Cell;',
      '  getCells(): Cell[];',
      '  gets(): void;',
      '}',
    ].join('\n');

    expect(fieldBreaksIn(fixture(source))).toEqual([
      { rule: 'get', where: 'Board.size' },
      { rule: 'get', where: 'Board.get' },
      { rule: 'get', where: 'Board.getScore' },
      { rule: 'get', where: 'ReadonlyBoard.get' },
      { rule: 'get', where: 'ReadonlyBoard.getCells' },
    ]);
  });

  it('should_read_every_ts_file_of_the_domain_when_the_code_is_scanned', () => {
    const baseline = fieldBaseline.filter((entry) => entry.where !== 'LinesSnapshot.streak');

    expect(unexcused(codeBreaks(), baseline)).toEqual([
      { rule: 'field', where: 'LinesSnapshot.streak' },
    ]);
  });

  it('should_list_every_break_of_the_domain_when_the_baseline_is_read', () => {
    expect(unexcused(codeBreaks(), fieldBaseline)).toEqual([]);
  });

  it('should_keep_no_entry_that_the_code_lacks_when_the_baseline_is_read', () => {
    const inCode = new Set(codeBreaks().map(key));
    const keys = fieldBaseline.map(key);

    expect(fieldBaseline.filter((entry) => !inCode.has(key(entry)))).toEqual([]);
    expect(keys.filter((entry, index) => keys.indexOf(entry) !== index)).toEqual([]);
  });
});
