/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// Rule R-platform-layer (issue #287): the phone is the first target and the web is a second
// target of the same code. Only layer 4, `src/infrastructure/` and `app/`, reads the platform.
// A presenter, a use case or the domain never branches on it.

const fixtureDir = path.join(repoRoot, 'test/fixtures/platform');

// The packages that export the `Platform` object of React Native.
const PLATFORM_MODULES = new Set(['react-native', 'react-native-web']);

// Layer 4 inside `src/`. The other folder of layer 4, `app/`, holds no code that the gate reads.
const LAYER_4 = 'src/infrastructure/';

// A file name such as `clock.web.ts` targets one platform: the bundler picks it on that platform.
const PLATFORM_FILE = /\.(web|native|ios|android)\.tsx?$/;

// True when `node` is `require('<module>')` for a module of `PLATFORM_MODULES`.
function isPlatformRequire(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    PLATFORM_MODULES.has(node.arguments[0].text)
  );
}

// The local names that hold `Platform` or the whole module in one file. An import or
// a destructured `require()` may rename `Platform`, as `{ Platform as Device }` does.
function platformNames(file: ts.SourceFile): { platform: Set<string>; modules: Set<string> } {
  const platform = new Set<string>();
  const modules = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      PLATFORM_MODULES.has(node.moduleSpecifier.text)
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) modules.add(bindings.name.text);
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if ((element.propertyName ?? element.name).getText(file) === 'Platform') {
            platform.add(element.name.text);
          }
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer !== undefined &&
      isPlatformRequire(node.initializer)
    ) {
      if (ts.isIdentifier(node.name)) modules.add(node.name.text);
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const key = element.propertyName ?? element.name;
          if (key.getText(file) === 'Platform' && ts.isIdentifier(element.name)) {
            platform.add(element.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { platform, modules };
}

// True when the identifier `node` is a use of a value, not a declaration or a property name.
function isValueUse(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isBindingElement(parent)) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  return true;
}

// Lists each read of the platform in one file, as `<file>:<line> <text>`. A read is a use
// of `Platform` from React Native, also through a renamed import, a namespace import,
// a destructuring or `require()`, and a read of `process.env.EXPO_OS`, the platform that
// Expo inlines. A file whose name targets one platform counts as one read on line 1.
// The TypeScript parser reads the code, so a comment or a string never counts.
function platformReads(source: string, fileName: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const { platform, modules } = platformNames(file);
  const found: string[] = PLATFORM_FILE.test(fileName)
    ? [`${fileName}:1 a file for one platform`]
    : [];
  const report = (node: ts.Node): void => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    found.push(`${fileName}:${line} ${node.getText(file)}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && platform.has(node.text) && isValueUse(node)) report(node);
    if (ts.isPropertyAccessExpression(node)) {
      const owner = node.expression;
      const name = node.name.text;
      const ofModule =
        (ts.isIdentifier(owner) && modules.has(owner.text)) || isPlatformRequire(owner);
      if (name === 'Platform' && ofModule) report(node);
      if (name === 'EXPO_OS' && owner.getText(file) === 'process.env') report(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

// Lists each read of the platform outside layer 4 under `root`: every `.ts` and `.tsx` file
// of `src/` at any depth, but `src/infrastructure/`. The gate reads no route of `app/`,
// which is layer 4, and no test, script or fixture of the repository.
function readsOutsideLayer4(root: string): string[] {
  return readdirSync(path.join(root, 'src'), { recursive: true, encoding: 'utf8' })
    .map((file) => `src/${file.split(path.sep).join('/')}`)
    .filter((file) => /\.tsx?$/.test(file) && !file.startsWith(LAYER_4))
    .sort()
    .flatMap((file) => platformReads(readFileSync(path.join(root, file), 'utf8'), file));
}

describe('platform gate', () => {
  it('should_report_each_read_of_the_platform_when_files_outside_layer_4_read_it', () => {
    expect(readsOutsideLayer4(path.join(fixtureDir, 'violating'))).toEqual([
      'src/adapters/screen-size.ts:6 Platform',
      'src/adapters/screen-size.ts:7 Platform',
      'src/adapters/screen-size.ts:8 Device',
      'src/adapters/screen-size.ts:10 ReactNative.Platform',
      'src/adapters/screen-size.ts:11 process.env.EXPO_OS',
      "src/adapters/screen-size.ts:12 require('react-native').Platform",
      'src/application/clock.web.ts:1 a file for one platform',
      'src/domain/engine/board-size.ts:4 Host',
    ]);
  });

  it('should_report_nothing_when_files_name_the_platform_without_reading_it', () => {
    expect(readsOutsideLayer4(path.join(fixtureDir, 'clean'))).toEqual([]);
  });

  it('should_allow_a_read_of_the_platform_when_the_file_is_in_layer_4', () => {
    const font = 'src/infrastructure/ui/font.ts';
    const route = 'app/index.tsx';
    const read = (file: string) =>
      platformReads(readFileSync(path.join(fixtureDir, 'clean', file), 'utf8'), file);

    // The gate sees each read of layer 4, and it allows it.
    expect([...read(font), ...read(route)]).toEqual([`${font}:4 Platform`, `${route}:5 Platform`]);
    expect(readsOutsideLayer4(path.join(fixtureDir, 'clean'))).toEqual([]);
  });

  it('should_report_nothing_when_the_real_code_outside_layer_4_is_scanned', () => {
    expect(readsOutsideLayer4(repoRoot)).toEqual([]);
  });
});
