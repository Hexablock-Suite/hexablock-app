import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// The folder that the two domain gates read (issue #231): every `.ts` file under it, at any depth.
export const domainDir = path.join(repoRoot, 'src/domain');

// The text of every `.ts` file under `src/domain/`, each named by its absolute path.
export function domainSources(): Record<string, string> {
  const files = readdirSync(domainDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .map((file) => path.join(domainDir, file));
  return Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')]));
}

export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

// A private member has the `private` modifier or a `#` name.
export const isPrivate = (node: ts.Node) =>
  hasModifier(node, ts.SyntaxKind.PrivateKeyword) ||
  (ts.isClassElement(node) && node.name !== undefined && ts.isPrivateIdentifier(node.name));

export function nameOf(node: ts.NamedDeclaration): string {
  return node.name?.getText() ?? 'constructor';
}

// The exported classes and interfaces of a source file.
export function exportedTypes(
  source: ts.SourceFile,
): (ts.ClassDeclaration | ts.InterfaceDeclaration)[] {
  return source.statements.filter(
    (statement): statement is ts.ClassDeclaration | ts.InterfaceDeclaration =>
      (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword),
  );
}
