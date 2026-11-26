/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

const PACKAGE_JSON = path.join(repoRoot, 'package.json');
const DOC = path.join(repoRoot, 'docs/DEPENDENCIES.md');

// A map of package.json whose entries the document explains.
type DependencyMap = Record<string, string>;

// A markdown list-item line explains one package: `- \`<name>\` — <reason>`.
// Only lines of that shape count. The reason after the name must not be empty,
// so a bare `- \`name\`` explains nothing.
const explainedNames = (doc: string): string[] =>
  [...doc.matchAll(/^- `([^`]+)`(.*)$/gm)]
    .map((match) => ({ name: match[1], reason: match[2].replace(/^\s*—/, '').trim() }))
    .filter((entry) => entry.reason.length > 0)
    .map((entry) => entry.name);

// Returns the names of the map that the document does not explain.
// An absent document explains nothing, so the gate reports every name.
// The check is one-way: a line about a package that the map does not list fails nothing.
const unexplained = (dependencies: DependencyMap, doc: string | null): string[] => {
  const explained = new Set(doc === null ? [] : explainedNames(doc));
  return Object.keys(dependencies).filter((name) => !explained.has(name));
};

// Inline fixture data of the gate.
const FIXTURE_DEPENDENCIES: DependencyMap = {
  'expo-router': '~58.0.31',
  'openapi-fetch': '0.17.0',
  'react-native-svg': '15.16.0',
};

const FIXTURE_LINES = [
  '- `expo-router` — the file-based routes of `app/`.',
  '- `openapi-fetch` — the typed HTTP client of the backend.',
  '- `react-native-svg` — the outline of each board cell.',
];

const fixtureDoc = (lines: string[]): string =>
  ['# Dependencies', '', '## Dependencies', '', ...lines, ''].join('\n');

// The real repository data. The document may be absent while the gate grows.
const packageJson: { dependencies?: DependencyMap; devDependencies?: DependencyMap } = JSON.parse(
  readFileSync(PACKAGE_JSON, 'utf8'),
);
const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : null;

// Gate of rule R-dependencies-doc: every entry of package.json has its reason.
describe('dependencies gate', () => {
  it('should_report_no_package_when_the_document_explains_every_dependency', () => {
    expect(unexplained(packageJson.dependencies ?? {}, doc)).toEqual([]);
    expect(unexplained(packageJson.devDependencies ?? {}, doc)).toEqual([]);
  });

  it('should_report_no_package_when_every_fixture_dependency_has_a_reason', () => {
    expect(unexplained(FIXTURE_DEPENDENCIES, fixtureDoc(FIXTURE_LINES))).toEqual([]);
  });

  it('should_report_the_package_when_the_document_misses_its_entry', () => {
    const doc = fixtureDoc(FIXTURE_LINES.filter((line) => !line.includes('react-native-svg')));

    expect(unexplained(FIXTURE_DEPENDENCIES, doc)).toEqual(['react-native-svg']);
  });

  it.each([['- `openapi-fetch`'], ['- `openapi-fetch` —'], ['- `openapi-fetch` —   ']])(
    'should_report_the_package_when_its_line_has_no_reason',
    (bareLine) => {
      const doc = fixtureDoc(
        FIXTURE_LINES.map((line) => (line.includes('openapi-fetch') ? bareLine : line)),
      );

      expect(unexplained(FIXTURE_DEPENDENCIES, doc)).toEqual(['openapi-fetch']);
    },
  );

  it('should_report_the_package_when_only_prose_mentions_it', () => {
    const doc = fixtureDoc([
      ...FIXTURE_LINES.filter((line) => !line.includes('expo-router')),
      'The app routes with `expo-router`.',
    ]);

    expect(unexplained(FIXTURE_DEPENDENCIES, doc)).toEqual(['expo-router']);
  });

  it('should_report_no_package_when_the_document_explains_a_package_the_map_lacks', () => {
    const doc = fixtureDoc([
      ...FIXTURE_LINES,
      '- `left-pad` — a package that the app no longer lists.',
    ]);

    expect(unexplained(FIXTURE_DEPENDENCIES, doc)).toEqual([]);
  });

  it('should_report_every_package_when_the_document_is_absent', () => {
    expect(unexplained(FIXTURE_DEPENDENCIES, null)).toEqual([
      'expo-router',
      'openapi-fetch',
      'react-native-svg',
    ]);
  });
});
