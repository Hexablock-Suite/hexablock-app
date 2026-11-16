/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';
import { primitiveBaseline, type PrimitiveEntry } from './domain-baseline';
import { domainDir, domainSources, hasModifier, isPrivate, nameOf } from './domain-source';

// APP-NFR-25 (issue #231): no primitive type stays in the domain model, except a `boolean`.
// The gate reads every `.ts` file under `src/domain/`. It reads the exported classes, interfaces,
// type aliases, functions and variables (`export const`, `export let`). It reads the written type
// of each member. When a member has no written type, the scan reads the type that the TypeScript
// checker infers.
// A primitive is `number`, `string` or a literal type, such as `'playing'` or `3` (issue #207,
// classes.md decision 45). A closed union of texts is a `string` with a name, so the scan lists
// each text literal as a `string` and each number literal as a `number`.
// A class with a closed set of instances replaces such a union.
// The gate allows these places, and no other place:
// - a `boolean`, `true`, `false` and `null`;
// - a private member, with the `private` modifier or a `#` name;
// - a parameter of a `private` or `protected` constructor;
// - the parameters of a static factory method: a `static` method of an exported class whose
//   constructor is `private`, and whose return type is that class;
// - the parameters of an entry of the fixed factory list below;
// - `deliverTo(receiver: ValueReceiver<T>): void`, which gives the value only to an adapter
//   of the edge (rule R-no-delivery-call).
// A `private` parameter property of a public constructor is a constructor parameter,
// because the caller passes it.
// A README row allows nothing. Only an entry of the baseline list (`domain-baseline.ts`)
// excuses a primitive, and each entry names the issue that removes it.
// The README table «Primitive types» explains some places. The gate fails when a row names
// a place that the scan does not find.

const engineDir = path.join(domainDir, 'engine');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

// The coordinate builders that are not static methods of their class.
// The list does not shrink: a new entry is a change of the gate that its pull request names.
// Each entry returns a class with a private constructor and a static factory method.
const factoryList = [
  'hex',
  'square',
  'triangle',
  'GeometryFactory.createCoord',
  'HexGeometry.createCoord',
  'SquareGeometry.createCoord',
  'TriangleGeometry.createCoord',
];

type Primitive = 'number' | 'string';
type Use = { primitive: Primitive; where: string };
// One primitive at one place. `counted` is false when a rule of the gate allows it.
type Finding = Use & { counted: boolean };

const key = (use: Use) => `${use.primitive} ${use.where}`;

// The primitive of a literal type: `'playing'` is a `string`, and `3` or `-1` is a `number`.
// `true`, `false` and `null` are not primitives of this gate.
function literalPrimitive(node: ts.Node): Primitive | undefined {
  if (!ts.isLiteralTypeNode(node)) return undefined;
  const { literal } = node;
  if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) return 'string';
  if (ts.isNumericLiteral(literal) || ts.isPrefixUnaryExpression(literal)) return 'number';
  return undefined;
}

// The primitive keywords and the literal types inside a type, a parameter list
// or a type parameter list.
function primitivesIn(nodes: readonly (ts.Node | undefined)[]): Primitive[] {
  const found = new Set<Primitive>();
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.NumberKeyword) found.add('number');
    if (node.kind === ts.SyntaxKind.StringKeyword) found.add('string');
    const literal = literalPrimitive(node);
    if (literal !== undefined) found.add(literal);
    ts.forEachChild(node, visit);
  };
  nodes.forEach((node) => node && visit(node));
  return [...found];
}

// The primitives at one place. A primitive of `all` is counted when it is also in `counted`.
function findingsAt(
  where: string,
  all: readonly (ts.Node | undefined)[],
  counted: readonly (ts.Node | undefined)[] = all,
): Finding[] {
  const kept = new Set(primitivesIn(counted));
  return primitivesIn(all).map((primitive) => ({ primitive, where, counted: kept.has(primitive) }));
}

// The type parameters of a declaration, one place each: `Owner<TParam>`.
function typeParameterUses(
  owner: string,
  node: ts.DeclarationWithTypeParameterChildren,
): Finding[] {
  return (node.typeParameters ?? []).flatMap((parameter) =>
    findingsAt(`${owner}<${parameter.name.text}>`, [parameter.constraint]),
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

type Callable =
  | ts.MethodDeclaration
  | ts.MethodSignature
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration
  | ts.FunctionDeclaration;

const isCallable = (member: ts.Node): member is Callable =>
  ts.isMethodDeclaration(member) ||
  ts.isMethodSignature(member) ||
  ts.isGetAccessorDeclaration(member) ||
  ts.isSetAccessorDeclaration(member) ||
  ts.isFunctionDeclaration(member);

// The signature of a member: its type parameters, its parameter types and its type.
// A method body and an initializer are not part of the signature.
function signature(member: ts.Node, checker: ts.TypeChecker): (ts.Node | undefined)[] {
  if (isCallable(member)) {
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

// The signature of a member without its parameter types.
function withoutParameters(member: ts.Node, checker: ts.TypeChecker): (ts.Node | undefined)[] {
  if (!isCallable(member)) return signature(member, checker);
  return [...(member.typeParameters ?? []), typeOf(member, checker)];
}

// The classes that a type names, such as `Range` for `Range<number>`.
function classesOf(type: ts.Type): ts.ClassDeclaration[] {
  return type.getSymbol()?.declarations?.filter(ts.isClassDeclaration) ?? [];
}

function hasPrivateConstructor(owner: ts.ClassDeclaration): boolean {
  return owner.members.some((member) => ts.isConstructorDeclaration(member) && isPrivate(member));
}

// A static factory method: a `static` method of a class whose constructor is `private`,
// and whose return type is that class.
function isStaticFactory(
  member: ts.Node,
  owner: ts.ClassDeclaration | ts.InterfaceDeclaration,
  checker: ts.TypeChecker,
): boolean {
  if (!ts.isClassDeclaration(owner) || !ts.isMethodDeclaration(member)) return false;
  if (!hasModifier(member, ts.SyntaxKind.StaticKeyword) || !hasPrivateConstructor(owner)) {
    return false;
  }
  const call = checker.getSignatureFromDeclaration(member);
  return call !== undefined && classesOf(checker.getReturnTypeOfSignature(call)).includes(owner);
}

// A public `deliverTo` whose only parameter is a `ValueReceiver<T>` and whose return type is `void`.
function isDelivery(member: ts.Node, checker: ts.TypeChecker): boolean {
  if (!ts.isMethodDeclaration(member) && !ts.isMethodSignature(member)) return false;
  if (nameOf(member) !== 'deliverTo' || hasModifier(member, ts.SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  const [parameter, ...rest] = member.parameters;
  if (parameter === undefined || rest.length > 0) return false;
  const type = typeOf(parameter, checker);
  const receiver =
    type !== undefined &&
    ts.isTypeReferenceNode(type) &&
    ts.isIdentifier(type.typeName) &&
    type.typeName.text === 'ValueReceiver';
  return receiver && typeOf(member, checker)?.kind === ts.SyntaxKind.VoidKeyword;
}

// The part of the signature of a member that the gate counts.
function countedSignature(
  where: string,
  member: ts.Node,
  owner: ts.ClassDeclaration | ts.InterfaceDeclaration,
  checker: ts.TypeChecker,
): (ts.Node | undefined)[] {
  if (isDelivery(member, checker)) return [];
  if (factoryList.includes(where) || isStaticFactory(member, owner, checker)) {
    return withoutParameters(member, checker);
  }
  return signature(member, checker);
}

function constructorUses(
  owner: string,
  ctor: ts.ConstructorDeclaration,
  checker: ts.TypeChecker,
): Finding[] {
  // A caller cannot call a private or protected constructor, so its parameters pass.
  const closed = isPrivate(ctor) || hasModifier(ctor, ts.SyntaxKind.ProtectedKeyword);
  return ctor.parameters.flatMap((parameter) => {
    const type = [typeOf(parameter, checker)];
    // A parameter property that is not private is a member of the class.
    if (ts.isParameterPropertyDeclaration(parameter, ctor) && !isPrivate(parameter)) {
      return findingsAt(`${owner}.${nameOf(parameter)}`, type);
    }
    // Any other parameter, a private parameter property too, is a value that the caller passes.
    return closed ? [] : findingsAt(`${owner}.constructor`, type);
  });
}

function memberUses(
  owner: ts.ClassDeclaration | ts.InterfaceDeclaration,
  checker: ts.TypeChecker,
): Finding[] {
  const name = owner.name?.text ?? 'default';
  return (owner.members as readonly ts.Node[]).flatMap((member) => {
    if (ts.isConstructorDeclaration(member)) return constructorUses(name, member, checker);
    if (isPrivate(member)) return [];
    const where = `${name}.${nameOf(member as ts.NamedDeclaration)}`;
    return findingsAt(
      where,
      signature(member, checker),
      countedSignature(where, member, owner, checker),
    );
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
function variableUses(statement: ts.VariableStatement, checker: ts.TypeChecker): Finding[] {
  return statement.declarationList.declarations.flatMap((declaration) => {
    const typed = ts.isIdentifier(declaration.name)
      ? [{ name: declaration.name, type: typeOf(declaration, checker) }]
      : boundNames(declaration.name).map((name) => ({ name, type: inferredType(name, checker) }));
    return typed.flatMap(({ name, type }) => findingsAt(name.text, [type]));
  });
}

function declarationUses(statement: ts.Statement, checker: ts.TypeChecker): Finding[] {
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return [];
  if (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    const owner = statement.name?.text ?? 'default';
    return [...typeParameterUses(owner, statement), ...memberUses(statement, checker)];
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    const owner = statement.name.text;
    return [...typeParameterUses(owner, statement), ...findingsAt(owner, [statement.type])];
  }
  if (ts.isFunctionDeclaration(statement)) {
    const owner = statement.name?.text ?? 'default';
    // The function's own type parameters are listed once, as `owner<TParam>`.
    const own = statement.typeParameters?.length ?? 0;
    const all = signature(statement, checker).slice(own);
    const counted = factoryList.includes(owner)
      ? withoutParameters(statement, checker).slice(own)
      : all;
    return [...typeParameterUses(owner, statement), ...findingsAt(owner, all, counted)];
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

// The source files of a program, in the order of the given files.
function sourcesOf(program: ts.Program, files: Record<string, string>): ts.SourceFile[] {
  return Object.keys(files).map((file) => {
    const source = program.getSourceFile(file);
    if (source === undefined) throw new Error(`The program has no file ${file}.`);
    return source;
  });
}

// The findings in a set of source files, each named by its path.
function scan(files: Record<string, string>): Finding[] {
  const program = programOf(files);
  const checker = program.getTypeChecker();
  return sourcesOf(program, files).flatMap((source) =>
    source.statements.flatMap((statement) => declarationUses(statement, checker)),
  );
}

// Each place once, in the order of the scan.
function unique(findings: Finding[]): Use[] {
  const uses = findings.map(({ primitive, where }) => ({ primitive, where }));
  return [...new Map(uses.map((use) => [key(use), use])).values()];
}

// Every primitive in a public signature, also one that a rule of the gate allows.
const usesIn = (files: Record<string, string>): Use[] => unique(scan(files));

// The primitives that no rule of the gate allows: the breaks of APP-NFR-25.
const breaksIn = (files: Record<string, string>): Use[] =>
  unique(scan(files).filter((finding) => finding.counted));

// The scan of `src/domain/` is the same for every test, so it runs once.
let domainFindings: Finding[] | undefined;
function codeFindings(): Finding[] {
  domainFindings ??= scan(domainSources());
  return domainFindings;
}

const codeUses = (): Use[] => unique(codeFindings());
const codeBreaks = (): Use[] => unique(codeFindings().filter((finding) => finding.counted));

// The classes that a type parameter of an interface or a class stands for:
// the type argument of each class of the files that implements or extends its owner.
function boundClasses(
  declaration: ts.SignatureDeclaration,
  parameter: ts.Type,
  sources: ts.SourceFile[],
  checker: ts.TypeChecker,
): ts.ClassDeclaration[] {
  const owner = declaration.parent;
  if (!ts.isInterfaceDeclaration(owner) && !ts.isClassDeclaration(owner)) return [];
  const index = (owner.typeParameters ?? []).findIndex(
    (typeParameter) => checker.getTypeAtLocation(typeParameter) === parameter,
  );
  return sources
    .flatMap((source) => source.statements.filter(ts.isClassDeclaration))
    .flatMap((type) => (type.heritageClauses ?? []).flatMap((clause) => clause.types))
    .filter((base) => ts.isIdentifier(base.expression) && base.expression.text === owner.name?.text)
    .flatMap((base) => {
      const argument = base.typeArguments?.[index];
      return argument === undefined ? [] : classesOf(checker.getTypeFromTypeNode(argument));
    });
}

// The classes that a declaration returns.
function returnedClasses(
  declaration: ts.SignatureDeclaration,
  sources: ts.SourceFile[],
  checker: ts.TypeChecker,
): ts.ClassDeclaration[] {
  const call = checker.getSignatureFromDeclaration(declaration);
  if (call === undefined) return [];
  const type = checker.getReturnTypeOfSignature(call);
  if (type.isTypeParameter()) return boundClasses(declaration, type, sources, checker);
  return classesOf(type);
}

// The exported functions and the methods of the exported classes and interfaces, by place.
function callablesOf(sources: ts.SourceFile[]): Map<string, ts.SignatureDeclaration> {
  const found = new Map<string, ts.SignatureDeclaration>();
  for (const statement of sources.flatMap((source) => source.statements)) {
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      found.set(statement.name.text, statement);
    }
    if (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      for (const member of statement.members as readonly ts.Node[]) {
        if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
          found.set(`${statement.name?.text}.${nameOf(member)}`, member);
        }
      }
    }
  }
  return found;
}

// The entries of the factory list that do not return a class with a private constructor
// and a static factory method. A type parameter, such as `TCoord` of `GeometryFactory`,
// stands for the type argument of each class that implements its interface.
function factoryListProblems(files: Record<string, string>): string[] {
  const program = programOf(files);
  const checker = program.getTypeChecker();
  const sources = sourcesOf(program, files);
  const callables = callablesOf(sources);
  return factoryList.flatMap((where) => {
    const declaration = callables.get(where);
    if (declaration === undefined) return [`${where} is not found.`];
    const classes = returnedClasses(declaration, sources, checker);
    if (classes.length === 0) return [`${where} returns no class.`];
    return classes
      .filter(
        (type) =>
          !hasPrivateConstructor(type) ||
          !type.members.some((member) => isStaticFactory(member, type, checker)),
      )
      .map(
        (type) =>
          `${where} returns ${type.name?.text}, ` +
          'which lacks a private constructor or a static factory method.',
      );
  });
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

// The breaks that have no entry in the baseline list. The gate fails when this list is not empty.
// A README row excuses nothing.
function unexcused(breaks: Use[], baseline: readonly PrimitiveEntry[]): Use[] {
  const excused = new Set(baseline.map(key));
  return breaks.filter((use) => !excused.has(key(use)));
}

// A source file at a place under `src/domain/`. The file exists only in the program of the test.
const fixture = (name: string, source: string) => ({ [path.join(engineDir, name)]: source });
const variantFixture = (name: string, source: string) => ({
  [path.join(domainDir, 'variants/hexa-lines', name)]: source,
});

describe('primitive scan of the domain', () => {
  it('should_find_a_primitive_in_the_engine_when_the_code_is_scanned', () => {
    const uses = codeUses();

    expect(uses).toContainEqual({ primitive: 'number', where: 'Turns.of' });
    expect(uses).toContainEqual({ primitive: 'string', where: 'GameId.of' });
  });

  // Issue #203: `Score` replaces the number of every score in the engine.
  // Only the factory and the delivery to a receiver keep a number. `Score.times()` is gone
  // (issue #232). The value is private (issue #228), so the scan finds no `Score.value`.
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
      'Score.of',
      'Score.deliverTo',
    ]);
  });

  // Issue #204: `Moves`, `ElapsedTime`, `Stars` and `LevelId` replace the numbers and the text
  // of the counters in the engine. Only the factory and the delivery to a receiver of each one
  // keep a primitive. Each value is private (issue #228), so the scan finds no `value`.
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
      { primitive: 'number', where: 'ElapsedTime.ofMs' },
      { primitive: 'number', where: 'ElapsedTime.deliverTo' },
      { primitive: 'string', where: 'LevelId.of' },
      { primitive: 'string', where: 'LevelId.deliverTo' },
      { primitive: 'number', where: 'Moves.of' },
      { primitive: 'number', where: 'Moves.deliverTo' },
      { primitive: 'number', where: 'Stars.of' },
      { primitive: 'number', where: 'Stars.deliverTo' },
    ]);
  });

  // Issue #206: the three coordinates, `Radius` and `RegionSize` keep their numbers private.
  // Only the factory methods keep a primitive. Since issue #243 the operations of the two counts
  // and the distance of two cells take and give value objects.
  // A coordinate gives its `CoordKey` to its topology, not a text (issue #237).
  // Issue #165: each coordinate delivers its two values to a receiver of the edge.
  // The gate allows that delivery, so it is no break and needs no baseline entry.
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
      'number HexCoord.deliverTo',
      'number HexCoord.of',
      'number Radius.of',
      'number RegionSize.of',
      'number SquareCoord.deliverTo',
      'number SquareCoord.of',
      'number TriangleCoord.deliverTo',
      'number TriangleCoord.of',
    ]);
  });

  // Issue #207: the closed unions of texts are classes with a closed set of instances.
  // Only the two factories and the delivery of the text of each class keep a `string`.
  // The delivery is allowed, and `toString()` is gone (issue #237).
  it('should_find_no_closed_union_of_texts_when_the_code_is_scanned', () => {
    const uses = codeUses();
    const places = uses.map((use) => use.where);

    for (const place of [
      'Outcome',
      'TopologyId',
      'HexAxis',
      'HexDirection',
      'SquareAxis',
      'SquareDirection',
      'TriangleAxis',
      'TriangleDirection',
      'GeometryFactory.id',
      'HexGeometry.id',
      'SquareGeometry.id',
      'TriangleGeometry.id',
      'GridTopology<TAxis>',
      'GridTopology<TDirection>',
      'Board<TAxis>',
      'ReadonlyBoard<TAxis>',
      'checkOwnSnapshot<TAxis>',
      'TurnReport.outcome',
      'GameOver.outcome',
      'Resolution.outcome',
    ]) {
      expect(places).not.toContain(place);
    }
    const ofClosedSets = uses.filter((use) =>
      /^(Outcome|TopologyId|(Hex|Square|Triangle)(Axis|Direction))\./.test(use.where),
    );
    expect(ofClosedSets.map(key).sort()).toEqual([
      'string HexAxis.deliverTo',
      'string HexDirection.deliverTo',
      'string Outcome.deliverTo',
      'string Outcome.of',
      'string SquareAxis.deliverTo',
      'string SquareDirection.deliverTo',
      'string TopologyId.deliverTo',
      'string TopologyId.of',
      'string TriangleAxis.deliverTo',
      'string TriangleDirection.deliverTo',
    ]);
  });

  // Issue #210, classes.md decision 48: a seed is a `Seed`, not a number.
  // Only the factory of `Seed` keeps a primitive. The first state of a generator is a
  // `GeneratorState` since issue #243.
  it('should_find_no_seed_of_type_number_when_the_code_is_scanned', () => {
    const uses = codeUses();
    const places = uses.map((use) => use.where);

    for (const place of [
      'IRandomSeeded.seed',
      'SeededPieceSource.seed',
      'SeededPieceSource.constructor',
      'Mulberry32Random.constructor',
      'Mulberry32Random.from',
      'Seed.value',
    ]) {
      expect(places).not.toContain(place);
    }
    const ofSeed = uses.filter((use) => use.where.startsWith('Seed.'));
    expect(ofSeed.map(key).sort()).toEqual(['number Seed.of']);
  });

  // Issue #243: value objects replace the last primitives of the engine signatures:
  // a random draw, a generator state, the area of a shape, a distance of the board and an undo
  // limit. Each one keeps its number private. Only its factory method keeps a primitive,
  // and a random draw gives its number to a receiver of the edge.
  it('should_find_no_engine_primitive_that_keeps_a_readme_reason_when_the_code_is_scanned', () => {
    const uses = codeUses();
    const places = uses.map((use) => use.where);

    for (const place of [
      'RandomSource.next',
      'Mulberry32Random.next',
      'Seed.generatorState',
      'ShapeNode.area',
      'CellNode.area',
      'ShapeGroup.area',
      'HexCoord.distanceTo',
      'SquareCoord.distanceTo',
      'Radius.offsets',
      'Radius.measures',
      'RegionSize.indexes',
      'RegionSize.offsets',
      'RegionSize.holds',
      'MoveHistory.constructor',
    ]) {
      expect(places).not.toContain(place);
    }
    const ofValues = uses.filter((use) =>
      /^(RandomDraw|GeneratorState|Area|Distance|UndoLimit)\./.test(use.where),
    );
    expect(ofValues.map(key).sort()).toEqual([
      'number Area.of',
      'number Distance.of',
      'number GeneratorState.of',
      'number RandomDraw.deliverTo',
      'number RandomDraw.of',
      'number UndoLimit.of',
    ]);
  });

  // Issue #232: value objects of the game replace the primitives that crossed the public
  // signatures of the variants. `Score.times()` is gone: the Lines counts give their points.
  // The constants of the variants stay private to their files.
  it('should_find_no_primitive_of_a_variant_when_the_code_is_scanned', () => {
    const places = codeUses().map((use) => use.where);

    for (const place of [
      'Score.times',
      'LinesSnapshot.streak',
      'LinesSnapshot.linesCleared',
      'LinesSnapshot.cellsPlaced',
      'LinesState.constructor',
      'PlacePiece.constructor',
      'SortSnapshot.clearedTiles',
      'ColorStack.tileCount',
      'NewTile.of',
      'Chance.hits',
      'FIT_POINTS_PER_TURN',
      'POINTS_PER_CELL',
      'POINTS_PER_LINE',
      'TRAY_SIZE',
      'START_TILES',
      'MERGE_UNDO_LIMIT',
      'GOAL_RUN',
      'SORT_POINTS_PER_TILE',
    ]) {
      expect(places).not.toContain(place);
    }
  });

  it('should_list_a_literal_type_as_its_primitive_when_a_signature_names_a_closed_union', () => {
    const source = [
      "export type Outcome = 'playing' | 'victory';",
      'export type Sides = 3 | 4 | 6;',
      "export interface Topology<TAxis extends 'q' | 'r'> {",
      "  readonly id: 'hex';",
      "  line(axis: TAxis, toward: 'forward' | 'backward'): boolean;",
      '}',
      'export class Family {',
      "  readonly id = 'hex';",
      "  private readonly hidden = 'x';",
      '  done = true;',
      '}',
    ].join('\n');

    expect(usesIn(fixture('fixture-unions.ts', source))).toEqual([
      { primitive: 'string', where: 'Outcome' },
      { primitive: 'number', where: 'Sides' },
      { primitive: 'string', where: 'Topology<TAxis>' },
      { primitive: 'string', where: 'Topology.id' },
      { primitive: 'string', where: 'Topology.line' },
      { primitive: 'string', where: 'Family.id' },
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

    expect(usesIn(fixture('counter.ts', source))).toEqual([
      { primitive: 'number', where: 'Counter.count' },
      { primitive: 'string', where: 'Counter.title' },
      { primitive: 'string', where: 'Counter.phase' },
      { primitive: 'number', where: 'Counter.size' },
      { primitive: 'string', where: 'label' },
    ]);
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

    expect(usesIn(fixture('fixture-values.ts', source))).toEqual([
      { primitive: 'string', where: 'written' },
      { primitive: 'number', where: 'counted' },
      { primitive: 'number', where: 'width' },
      { primitive: 'string', where: 'label' },
      { primitive: 'number', where: 'first' },
      { primitive: 'number', where: 'total' },
      { primitive: 'string', where: 'phase' },
    ]);
  });

  it('should_list_no_primitive_that_the_domain_lacks_when_the_readme_table_is_read', () => {
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

describe('domain primitive gate', () => {
  // The variants have no break since #232, so a fixture under a variant folder stands for one.
  it('should_fail_the_gate_when_a_variant_signature_has_a_primitive_and_no_baseline_entry', () => {
    const source = 'export interface FixtureSnapshot {\n  readonly streak: number;\n}';

    expect(
      unexcused(breaksIn(variantFixture('fixture-tray.ts', 'export type TraySize = number;')), []),
    ).toEqual([{ primitive: 'number', where: 'TraySize' }]);
    expect(
      unexcused(breaksIn(variantFixture('fixture-photo.ts', source)), primitiveBaseline),
    ).toEqual([{ primitive: 'number', where: 'FixtureSnapshot.streak' }]);
  });

  // The README row of `ElapsedTime.ofMs` explains a factory method. The same place
  // as an interface member returns a primitive, and the row does not excuse it.
  it('should_fail_the_gate_when_only_a_readme_row_names_the_primitive', () => {
    const source = 'export interface ElapsedTime {\n  ofMs(): number;\n}';

    expect(readmeUses()).toContainEqual({ primitive: 'number', where: 'ElapsedTime.ofMs' });
    expect(unexcused(breaksIn(fixture('fixture-elapsed-time.ts', source)), [])).toEqual([
      { primitive: 'number', where: 'ElapsedTime.ofMs' },
    ]);
  });

  it('should_fail_the_gate_when_an_exported_number_constant_has_no_baseline_entry', () => {
    const source = 'export const fixtureLimit: number = 3;';

    const breaks = breaksIn(fixture('fixture-limit.ts', source));

    expect(unexcused(breaks, primitiveBaseline)).toEqual([
      { primitive: 'number', where: 'fixtureLimit' },
    ]);
  });

  it('should_fail_the_gate_when_an_exported_function_has_a_primitive_parameter_and_no_baseline_entry', () => {
    const source = 'export function fixtureScale(factor: number): void {}';

    const breaks = breaksIn(fixture('fixture-scale.ts', source));

    expect(unexcused(breaks, primitiveBaseline)).toEqual([
      { primitive: 'number', where: 'fixtureScale' },
    ]);
  });

  it('should_pass_the_parameters_of_a_static_factory_when_the_class_has_a_private_constructor', () => {
    const source = [
      'export class Money {',
      '  private constructor(private readonly cents: number) {}',
      '  static of(cents: number): Money {',
      '    return new Money(cents);',
      '  }',
      '  static parse(text: string): number {',
      '    return Number(text);',
      '  }',
      '}',
      'export class Span<T> {',
      '  private constructor(private readonly low: T) {}',
      '  static ofNumber(low: number): Span<number> {',
      '    return new Span(low);',
      '  }',
      '}',
      'export class Open {',
      '  constructor() {}',
      '  static of(size: number): Open {',
      '    return new Open();',
      '  }',
      '}',
    ].join('\n');

    expect(breaksIn(fixture('fixture-money.ts', source))).toEqual([
      { primitive: 'string', where: 'Money.parse' },
      { primitive: 'number', where: 'Money.parse' },
      { primitive: 'number', where: 'Span.ofNumber' },
      { primitive: 'number', where: 'Open.of' },
    ]);
  });

  it('should_pass_the_parameters_of_a_factory_list_entry_when_it_builds_a_coordinate', () => {
    const source = [
      'export class HexCoord {',
      '  private constructor(private readonly q: number) {}',
      '  static of(q: number): HexCoord {',
      '    return new HexCoord(q);',
      '  }',
      '}',
      'export function hex(q: number): HexCoord {',
      '  return HexCoord.of(q);',
      '}',
      'export function hexagon(q: number): HexCoord {',
      '  return HexCoord.of(q);',
      '}',
    ].join('\n');

    expect(breaksIn(fixture('fixture-hex.ts', source))).toEqual([
      { primitive: 'number', where: 'hexagon' },
    ]);
  });

  it('should_return_a_class_with_a_private_constructor_and_a_static_factory_when_a_factory_list_entry_is_read', () => {
    expect(factoryListProblems(domainSources())).toEqual([]);
  });

  it('should_report_a_factory_list_entry_when_it_returns_no_class_with_a_static_factory', () => {
    const source = [
      'export class SquareCoord {',
      '  constructor(private readonly col: number) {}',
      '}',
      'export function square(col: number): SquareCoord {',
      '  return new SquareCoord(col);',
      '}',
      'export function triangle(col: number): number {',
      '  return col;',
      '}',
    ].join('\n');

    expect(factoryListProblems(fixture('fixture-square.ts', source))).toEqual([
      'hex is not found.',
      'square returns SquareCoord, which lacks a private constructor or a static factory method.',
      'triangle returns no class.',
      'GeometryFactory.createCoord is not found.',
      'HexGeometry.createCoord is not found.',
      'SquareGeometry.createCoord is not found.',
      'TriangleGeometry.createCoord is not found.',
    ]);
  });

  it('should_pass_deliver_to_when_it_takes_only_a_value_receiver_and_returns_void', () => {
    const source = [
      'export interface ValueReceiver<T> {',
      '  receive(value: T): void;',
      '}',
      'export class Kept {',
      '  private constructor(private readonly value: number) {}',
      '  deliverTo(receiver: ValueReceiver<number>): void {',
      '    receiver.receive(this.value);',
      '  }',
      '}',
      'export class Returned {',
      '  private constructor(private readonly value: number) {}',
      '  deliverTo(receiver: ValueReceiver<number>): number {',
      '    return this.value;',
      '  }',
      '}',
      'export class Plain {',
      '  private constructor(private readonly value: number) {}',
      '  deliverTo(value: number): void {}',
      '}',
    ].join('\n');

    expect(breaksIn(fixture('fixture-receiver.ts', source))).toEqual([
      { primitive: 'number', where: 'Returned.deliverTo' },
      { primitive: 'number', where: 'Plain.deliverTo' },
    ]);
  });

  it('should_pass_a_boolean_result_when_a_query_returns_a_boolean', () => {
    const source = [
      'export class Grid {',
      '  readonly accepted: boolean = true;',
      '  contains(other: Grid): boolean {',
      '    return other === this;',
      '  }',
      '  isEmpty(): true {',
      '    return true;',
      '  }',
      '  size(): number {',
      '    return 0;',
      '  }',
      '}',
    ].join('\n');

    expect(breaksIn(fixture('fixture-grid.ts', source))).toEqual([
      { primitive: 'number', where: 'Grid.size' },
    ]);
  });

  it('should_pass_a_private_field_when_it_holds_a_primitive', () => {
    const source = [
      'export class Tally {',
      '  private count: number = 0;',
      "  private readonly label: string = 'tally';",
      '  #size = 0;',
      '  readonly total: number = 0;',
      '}',
    ].join('\n');

    expect(breaksIn(fixture('fixture-tally.ts', source))).toEqual([
      { primitive: 'number', where: 'Tally.total' },
    ]);
  });

  it('should_count_a_private_parameter_property_when_the_constructor_is_public', () => {
    const source = [
      'export class Move {',
      '  constructor(private readonly index: number) {}',
      '}',
      'export class Closed {',
      '  private constructor(private readonly index: number) {}',
      '}',
      'export abstract class Shielded {',
      '  protected constructor(private readonly index: number, label: string) {}',
      '}',
    ].join('\n');

    expect(breaksIn(fixture('fixture-move.ts', source))).toEqual([
      { primitive: 'number', where: 'Move.constructor' },
    ]);
  });

  it('should_list_every_break_of_the_domain_when_the_baseline_is_read', () => {
    expect(unexcused(codeBreaks(), primitiveBaseline)).toEqual([]);
  });

  it('should_keep_no_entry_that_the_code_lacks_when_the_baseline_is_read', () => {
    const inCode = new Set(codeBreaks().map(key));
    const keys = primitiveBaseline.map(key);

    expect(primitiveBaseline.filter((entry) => !inCode.has(key(entry)))).toEqual([]);
    expect(keys.filter((entry, index) => keys.indexOf(entry) !== index)).toEqual([]);
  });
});
