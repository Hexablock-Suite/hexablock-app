/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

// APP-NFR-08: the README section «SOLID Principles» has one example per principle,
// and each example links to the source file that holds it.

const principles = [
  'Single responsibility',
  'Open/closed',
  'Liskov substitution',
  'Interface segregation',
  'Dependency inversion',
];

const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

// The text between `## SOLID Principles` and the next level-2 heading.
function solidSection(text: string): string {
  return text.split('\n## SOLID Principles\n')[1]?.split('\n## ')[0] ?? '';
}

// The bullet of each principle, or undefined when the section has none.
function bulletOf(section: string, principle: string): string | undefined {
  return section.split('\n').find((line) => line.startsWith(`- **${principle}.**`));
}

// The relative link targets of one line, without the anchor.
function linksIn(line: string): string[] {
  return [...line.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
    .map((match) => match[1] ?? '')
    .filter((target) => !/^[a-z]+:/.test(target));
}

// The principles whose bullet has no link to an existing file under `src/`.
function principlesWithoutSourceLink(section: string): string[] {
  return principles.filter((principle) => {
    const links = linksIn(bulletOf(section, principle) ?? '');
    return !links.some((link) => link.startsWith('src/') && existsSync(path.join(repoRoot, link)));
  });
}

// Every relative link of the section whose file does not exist.
function brokenLinks(section: string): string[] {
  return linksIn(section).filter((link) => !existsSync(path.join(repoRoot, link)));
}

describe('README SOLID principles', () => {
  it('should_name_each_principle_once_when_the_section_is_read', () => {
    const section = solidSection(readme);

    expect(principles.filter((principle) => bulletOf(section, principle) === undefined)).toEqual(
      [],
    );
  });

  it('should_link_each_principle_to_an_existing_source_file_when_the_section_is_read', () => {
    expect(principlesWithoutSourceLink(solidSection(readme))).toEqual([]);
  });

  it('should_list_no_broken_link_when_the_section_is_read', () => {
    expect(brokenLinks(solidSection(readme))).toEqual([]);
  });

  it('should_report_the_link_when_it_points_to_a_missing_file', () => {
    const section = [
      '- **Interface segregation.** See [IUndoable](src/domain/engine/undoable.ts).',
      '- **Liskov substitution.** See [rules](src/domain/engine/rules.ts#L18).',
    ].join('\n');

    expect(brokenLinks(section)).toEqual(['src/domain/engine/undoable.ts']);
    expect(principlesWithoutSourceLink(section)).toEqual([
      'Single responsibility',
      'Open/closed',
      'Interface segregation',
      'Dependency inversion',
    ]);
  });
});
