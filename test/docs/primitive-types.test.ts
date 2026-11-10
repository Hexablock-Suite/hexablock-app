/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-25: no primitive type stays in the domain model, except a `boolean`, a private field
// and the factory method of a value object. The redesign reaches the rule one unit at a time.
// Until a unit lands, each primitive that stays has a reason. Every `number` and `string` in a public signature of
// `src/domain/engine/` needs a row in the README table «Primitive types».
// A `boolean` needs no row. The scan reads exported classes, interfaces, type aliases,
// functions and variables (`export const`, `export let`). It reads the written type of each
// member. When a member has no written type, the scan reads the type that the TypeScript
// checker infers. A literal type, such as `'playing'`, is not a primitive.

const engineDir = path.join(repoRoot, 'src/domain/engine');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

type Primitive = 'number' | 'string';
type Use = { primitive: Primitive; where: string };

const key = (use: Use) => `${use.primitive} ${use.where}`;

// The primitive keywords inside a type, a parameter list or a type parameter list.
function primitivesIn(nodes: readonly (ts.Node | undefined)[]): Primitive[] {
  const found = new Set<Primitive>();
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.NumberKeyword) found.add('number');
    if (node.kind === ts.SyntaxKind.StringKeyword) found.add('string');
    ts.forEachChild(node, visit);
  };
  nodes.forEach((node) => node && visit(node));
  return [...found];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

const isPrivate = (node: ts.Node) =>
  hasModifier(node, ts.SyntaxKind.PrivateKeyword) ||
  (ts.isClassElement(node) && node.name !== undefined && ts.isPrivateIdentifier(node.name));

function nameOf(node: ts.NamedDeclaration): string {
  return node.name?.getText() ?? 'constructor';
}

// The type parameters of a declaration, one place each: `Owner<TParam>`.
function typeParameterUses(owner: string, node: ts.DeclarationWithTypeParameterChildren): Use[] {
  return (node.typeParameters ?? []).flatMap((parameter) =>
    primitivesIn([parameter.constraint]).map((primitive) => ({
      primitive,
      where: `${owner}<${parameter.name.text}>`,
    })),
  );
}

type Declaration =
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.PropertySignature
  | ts.VariableDeclaration
  | ts.SignatureDeclaration;

const flags = ts.NodeBuilderFlags.NoTruncation;

// The type that the checker infers for a name.
function inferredType(name: ts.Node, checker: ts.TypeChecker): ts.Node | undefined {
  return checker.typeToTypeNode(checker.getTypeAtLocation(name), undefined, flags);
}

// The written type of a declaration. When no type is written, the checker infers it.
// For a method, an accessor or a function, the type is the return type.
function typeOf(node: Declaration, checker: ts.TypeChecker): ts.Node | undefined {
  if (node.type !== undefined) return node.type;
  if (
    ts.isParameter(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isVariableDeclaration(node)
  ) {
    return inferredType(node.name, checker);
  }
  const call = checker.getSignatureFromDeclaration(node);
  if (call === undefined) return undefined;
  return checker.typeToTypeNode(checker.getReturnTypeOfSignature(call), undefined, flags);
}

// The signature of a member: its type parameters, its parameter types and its type.
// A method body and an initializer are not part of the signature.
function signature(member: ts.Node, checker: ts.TypeChecker): (ts.Node | undefined)[] {
  if (
    ts.isMethodDeclaration(member) ||
    ts.isMethodSignature(member) ||
    ts.isGetAccessorDeclaration(member) ||
    ts.isSetAccessorDeclaration(member) ||
    ts.isFunctionDeclaration(member)
  ) {
    return [
      ...(member.typeParameters ?? []),
      ...member.parameters.map((parameter) => typeOf(parameter, checker)),
      typeOf(member, checker),
    ];
  }
  if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
    return [typeOf(member, checker)];
  }
  return [];
}

function constructorUses(
  owner: string,
  ctor: ts.ConstructorDeclaration,
  checker: ts.TypeChecker,
): Use[] {
  const ctorIsPrivate = isPrivate(ctor);
  return ctor.parameters.flatMap((parameter) => {
    const isProperty = ts.isParameterPropertyDeclaration(parameter, ctor);
    // A parameter property is a member: it is public unless it is private.
    if (isProperty && isPrivate(parameter)) return [];
    if (!isProperty && ctorIsPrivate) return [];
    const where = isProperty ? `${owner}.${nameOf(parameter)}` : `${owner}.constructor`;
    return primitivesIn([typeOf(parameter, checker)]).map((primitive) => ({ primitive, where }));
  });
}

function memberUses(owner: string, members: readonly ts.Node[], checker: ts.TypeChecker): Use[] {
  return members.flatMap((member) => {
    if (ts.isConstructorDeclaration(member)) return constructorUses(owner, member, checker);
    if (isPrivate(member)) return [];
    const where = `${owner}.${nameOf(member as ts.NamedDeclaration)}`;
    return primitivesIn(signature(member, checker)).map((primitive) => ({ primitive, where }));
  });
}

// The names that a destructuring pattern binds, at any depth.
function boundNames(pattern: ts.BindingPattern): ts.Identifier[] {
  return pattern.elements.flatMap((element) => {
    if (ts.isOmittedExpression(element)) return [];
    return ts.isIdentifier(element.name) ? [element.name] : boundNames(element.name);
  });
}

// Each declarator of an exported variable statement. A plain name reads its written type.
// Each name in a destructuring pattern reads the type that the checker infers.
function variableUses(statement: ts.VariableStatement, checker: ts.TypeChecker): Use[] {
  return statement.declarationList.declarations.flatMap((declaration) => {
    const typed = ts.isIdentifier(declaration.name)
      ? [{ name: declaration.name, type: typeOf(declaration, checker) }]
      : boundNames(declaration.name).map((name) => ({ name, type: inferredType(name, checker) }));
    return typed.flatMap(({ name, type }) =>
      primitivesIn([type]).map((primitive) => ({ primitive, where: name.text })),
    );
  });
}

function declarationUses(statement: ts.Statement, checker: ts.TypeChecker): Use[] {
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return [];
  if (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    const owner = statement.name?.text ?? 'default';
    return [
      ...typeParameterUses(owner, statement),
      ...memberUses(owner, statement.members, checker),
    ];
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    const owner = statement.name.text;
    const uses = primitivesIn([statement.type]).map((primitive) => ({ primitive, where: owner }));
    return [...typeParameterUses(owner, statement), ...uses];
  }
  if (ts.isFunctionDeclaration(statement)) {
    const owner = statement.name?.text ?? 'default';
    // The function's own type parameters are listed once, as `owner<TParam>`.
    const uses = primitivesIn(
      signature(statement, checker).slice(statement.typeParameters?.length ?? 0),
    );
    return [
      ...typeParameterUses(owner, statement),
      ...uses.map((primitive) => ({ primitive, where: owner })),
    ];
  }
  if (ts.isVariableStatement(statement)) return variableUses(statement, checker);
  return [];
}

// A program over the given files, so the checker can infer the types that are not written.
// Each file is named by its path. The standard library comes from the installed TypeScript.
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

// The uses in a set of source files, each named by its path.
function usesIn(files: Record<string, string>): Use[] {
  const program = programOf(files);
  const checker = program.getTypeChecker();
  const uses = Object.keys(files).flatMap((file) => {
    const source = program.getSourceFile(file);
    if (source === undefined) throw new Error(`The program has no file ${file}.`);
    return source.statements.flatMap((statement) => declarationUses(statement, checker));
  });
  return [...new Map(uses.map((use) => [key(use), use])).values()];
}

function codeUses(): Use[] {
  const files = readdirSync(engineDir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(engineDir, file));
  return usesIn(Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')])));
}

type Row = { primitive: string; places: string[]; reason: string };

// The rows of the table under «### Primitive types». The Where cell lists places in backticks.
function readmeRows(): Row[] {
  const section = readme.split('### Primitive types')[1]?.split('\n### ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map(([, primitive = '', where = '', reason = '']) => ({
      primitive: primitive.replace(/`/g, ''),
      places: [...where.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? ''),
      reason,
    }));
}

function readmeUses(): Use[] {
  return readmeRows().flatMap((row) =>
    row.places.map((where) => ({ primitive: row.primitive as Primitive, where })),
  );
}

// The uses that have no row in the README table. The gate fails when this list is not empty.
function unlisted(uses: Use[]): Use[] {
  const listed = new Set(readmeUses().map(key));
  return uses.filter((use) => !listed.has(key(use)));
}

describe('README primitive types', () => {
  it('should_find_a_primitive_in_the_engine_when_the_code_is_scanned', () => {
    const uses = codeUses();

    expect(uses).toContainEqual({ primitive: 'number', where: 'Turns.of' });
    expect(uses).toContainEqual({ primitive: 'string', where: 'GameId.of' });
  });

  // Issue #203: `Score` replaces the number of every score in the engine.
  // Only the factory, the readable value and the factor of `Score.times()` keep a number.
  it('should_find_no_score_of_type_number_when_the_code_is_scanned', () => {
    const numbers = codeUses()
      .filter((use) => use.primitive === 'number')
      .map((use) => use.where);

    for (const place of [
      'BoardSnapshot.score',
      'BoardState.addPoints',
      'IScoringPolicy.score',
      'ScoringDecorator.score',
      'GameOver.finalScore',
      'GameResult.score',
      'ProgressRecord.score',
    ]) {
      expect(numbers).not.toContain(place);
    }
    expect(numbers.filter((place) => place.startsWith('Score.'))).toEqual([
      'Score.value',
      'Score.of',
      'Score.times',
    ]);
  });

  // Issue #204: `Moves`, `ElapsedTime`, `Stars` and `LevelId` replace the numbers and the text
  // of the counters in the engine. Only the factory and the readable value of each one keep
  // a primitive.
  it('should_find_no_counter_of_a_primitive_type_when_the_code_is_scanned', () => {
    const places = codeUses().map((use) => use.where);

    for (const place of [
      'GameResult.moves',
      'GameResult.elapsedMs',
      'GameResult.levelId',
      'GameResult.of',
      'ProgressRecord.stars',
      'ProgressRecord.levelId',
      'ProgressRecord.of',
      'ITimed.elapsedMs',
      'LevelTimer.elapsedMs',
      'checkMoveCount',
    ]) {
      expect(places).not.toContain(place);
    }
    const ofCounters = codeUses().filter((use) =>
      /^(Moves|ElapsedTime|Stars|LevelId)\./.test(use.where),
    );
    expect(ofCounters).toEqual([
      { primitive: 'number', where: 'ElapsedTime.value' },
      { primitive: 'number', where: 'ElapsedTime.ofMs' },
      { primitive: 'string', where: 'LevelId.value' },
      { primitive: 'string', where: 'LevelId.of' },
      { primitive: 'number', where: 'Moves.value' },
      { primitive: 'number', where: 'Moves.of' },
      { primitive: 'number', where: 'Stars.value' },
      { primitive: 'number', where: 'Stars.of' },
    ]);
  });

  // Issue #206: the three coordinates, `Radius` and `RegionSize` keep their numbers private.
  // Only the factory methods, the operations of the two counts, the hex distance
  // and the text of a coordinate keep a primitive.
  it('should_find_no_public_value_of_a_coordinate_when_the_code_is_scanned', () => {
    const uses = codeUses();
    const places = uses.map((use) => use.where);

    for (const place of [
      'HexCoord.q',
      'HexCoord.r',
      'SquareCoord.col',
      'SquareCoord.row',
      'TriangleCoord.col',
      'TriangleCoord.row',
      'Radius.value',
      'RegionSize.value',
    ]) {
      expect(places).not.toContain(place);
    }
    const ofCoordinates = uses.filter((use) =>
      /^(HexCoord|SquareCoord|TriangleCoord|Radius|RegionSize)\./.test(use.where),
    );
    expect(ofCoordinates.map(key).sort()).toEqual([
      'number HexCoord.distanceTo',
      'number HexCoord.of',
      'number Radius.measures',
      'number Radius.of',
      'number Radius.offsets',
      'number RegionSize.holds',
      'number RegionSize.indexes',
      'number RegionSize.of',
      'number RegionSize.offsets',
      'number SquareCoord.of',
      'number TriangleCoord.of',
      'string HexCoord.toString',
      'string SquareCoord.toString',
      'string TriangleCoord.toString',
    ]);
  });

  it('should_skip_private_members_and_booleans_when_the_code_is_scanned', () => {
    const places = codeUses().map((use) => use.where);

    expect(places).not.toContain('Mulberry32Random.state');
    expect(places).not.toContain('Board.contains');
    expect(places).not.toContain('Resolution.accepted');
  });

  it('should_read_the_inferred_type_when_a_public_member_has_no_written_type', () => {
    const source = [
      'export class Counter {',
      '  count = 0;',
      "  title = 'none';",
      "  readonly phase = 'playing';",
      '  done = false;',
      '  private hidden = 1;',
      '  size() {',
      '    return this.count;',
      '  }',
      '}',
      'export function label(counter: Counter) {',
      '  return counter.title;',
      '}',
    ].join('\n');

    expect(usesIn({ [path.join(engineDir, 'counter.ts')]: source })).toEqual([
      { primitive: 'number', where: 'Counter.count' },
      { primitive: 'string', where: 'Counter.title' },
      { primitive: 'number', where: 'Counter.size' },
      { primitive: 'string', where: 'label' },
    ]);
  });

  it('should_list_every_primitive_of_the_engine_when_the_readme_table_is_read', () => {
    expect(unlisted(codeUses())).toEqual([]);
  });

  it('should_fail_the_gate_when_an_exported_number_constant_has_no_readme_row', () => {
    const source = 'export const fixtureLimit: number = 3;';

    const uses = usesIn({ [path.join(engineDir, 'fixture-limit.ts')]: source });

    expect(unlisted(uses)).toEqual([{ primitive: 'number', where: 'fixtureLimit' }]);
  });

  it('should_read_every_binding_when_an_exported_variable_statement_is_scanned', () => {
    const source = [
      'export const written: string = String(1);',
      'export let counted = 0;',
      "export const { width, label } = { width: 2, label: 'x' };",
      'export const [first] = [1];',
      'export const total = counted + 1, ready = false;',
      "export const phase = 'playing';",
      'const hidden = 1;',
    ].join('\n');

    expect(usesIn({ [path.join(engineDir, 'fixture-values.ts')]: source })).toEqual([
      { primitive: 'string', where: 'written' },
      { primitive: 'number', where: 'counted' },
      { primitive: 'number', where: 'width' },
      { primitive: 'string', where: 'label' },
      { primitive: 'number', where: 'first' },
      { primitive: 'number', where: 'total' },
    ]);
  });

  it('should_fail_the_gate_when_an_exported_function_has_a_primitive_parameter_and_no_row', () => {
    const source = 'export function fixtureScale(factor: number): void {}';

    const uses = usesIn({ [path.join(engineDir, 'fixture-scale.ts')]: source });

    expect(unlisted(uses)).toEqual([{ primitive: 'number', where: 'fixtureScale' }]);
  });

  it('should_list_no_primitive_that_the_engine_lacks_when_the_readme_table_is_read', () => {
    const inCode = new Set(codeUses().map(key));

    const extra = readmeUses().filter((use) => !inCode.has(key(use)));

    expect(extra).toEqual([]);
  });

  it('should_name_number_or_string_and_give_a_reason_when_the_table_is_read', () => {
    const rows = readmeRows();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !['number', 'string'].includes(row.primitive))).toEqual([]);
    expect(rows.filter((row) => row.places.length === 0 || row.reason === '')).toEqual([]);
  });
});
