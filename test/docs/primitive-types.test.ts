/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-25: the primitive types of the engine design tend to zero, and each one
// that stays has a reason. Every `number` and `string` in a public signature of
// `src/domain/engine/` needs a row in the README table «Primitive types».
// A `boolean` needs no row. The scan reads the written types, not the inferred ones.

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

// The signature of a member: its type parameters, its parameters and its type.
// A method body and an initializer are not part of the signature.
function signature(member: ts.Node): (ts.Node | undefined)[] {
  if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
    return [...(member.typeParameters ?? []), ...member.parameters, member.type];
  }
  if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
    return [...member.parameters, member.type];
  }
  if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) return [member.type];
  return [];
}

function constructorUses(owner: string, ctor: ts.ConstructorDeclaration): Use[] {
  const ctorIsPrivate = isPrivate(ctor);
  return ctor.parameters.flatMap((parameter) => {
    const isProperty = ts.isParameterPropertyDeclaration(parameter, ctor);
    // A parameter property is a member: it is public unless it is private.
    if (isProperty && isPrivate(parameter)) return [];
    if (!isProperty && ctorIsPrivate) return [];
    const where = isProperty ? `${owner}.${nameOf(parameter)}` : `${owner}.constructor`;
    return primitivesIn([parameter.type]).map((primitive) => ({ primitive, where }));
  });
}

function memberUses(owner: string, members: readonly ts.Node[]): Use[] {
  return members.flatMap((member) => {
    if (ts.isConstructorDeclaration(member)) return constructorUses(owner, member);
    if (isPrivate(member)) return [];
    const where = `${owner}.${nameOf(member as ts.NamedDeclaration)}`;
    return primitivesIn(signature(member)).map((primitive) => ({ primitive, where }));
  });
}

function declarationUses(statement: ts.Statement): Use[] {
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return [];
  if (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    const owner = statement.name?.text ?? 'default';
    return [...typeParameterUses(owner, statement), ...memberUses(owner, statement.members)];
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    const owner = statement.name.text;
    const uses = primitivesIn([statement.type]).map((primitive) => ({ primitive, where: owner }));
    return [...typeParameterUses(owner, statement), ...uses];
  }
  if (ts.isFunctionDeclaration(statement)) {
    const owner = statement.name?.text ?? 'default';
    const uses = primitivesIn([...statement.parameters, statement.type]).map((primitive) => ({
      primitive,
      where: owner,
    }));
    return [...typeParameterUses(owner, statement), ...uses];
  }
  return [];
}

function codeUses(): Use[] {
  const uses = readdirSync(engineDir)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => {
      const text = readFileSync(path.join(engineDir, file), 'utf8');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      return source.statements.flatMap(declarationUses);
    });
  return [...new Map(uses.map((use) => [key(use), use])).values()];
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

describe('README primitive types', () => {
  it('should_find_a_primitive_in_the_engine_when_the_code_is_scanned', () => {
    const uses = codeUses();

    expect(uses).toContainEqual({ primitive: 'number', where: 'GridTopology.rotationSteps' });
    expect(uses).toContainEqual({ primitive: 'string', where: 'GameId.of' });
  });

  it('should_skip_private_members_and_booleans_when_the_code_is_scanned', () => {
    const places = codeUses().map((use) => use.where);

    expect(places).not.toContain('SeededRandom.state');
    expect(places).not.toContain('Board.contains');
    expect(places).not.toContain('Resolution.accepted');
  });

  it('should_list_every_primitive_of_the_engine_when_the_readme_table_is_read', () => {
    const listed = new Set(readmeUses().map(key));

    const missing = codeUses().filter((use) => !listed.has(key(use)));

    expect(missing).toEqual([]);
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
