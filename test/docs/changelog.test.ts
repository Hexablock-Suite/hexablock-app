/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

const CHANGELOG = path.join(repoRoot, 'CHANGELOG.md');
const UNRELEASED = '## [Unreleased]';
const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;
const LINK = /\/(?:issues|pull)\/(\d+)\)/g;

// The issues and pull requests that each released version links (rule R-sprint-release).
// A released section does not change. When a sprint closes, add its version and links here.
// The table catches a later [Unreleased] entry that a merge puts under a released section.
const RELEASED: Record<string, number[]> = {
  '0.0.0': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 23],
  '0.1.0': [63, 67, 68, 69, 70, 71, 72, 73, 74, 75, 86],
};

// Returns true when the YYYY-MM-DD text names a day of the calendar.
function isRealDate(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date;
}

// Returns the version number of a dated version heading, or undefined for another line.
function headingVersion(line: string): string | undefined {
  const match = VERSION_HEADING.exec(line);
  return match && isRealDate(match[2]) ? match[1] : undefined;
}

// Returns the level-2 headings that are neither Unreleased nor a dated version.
function badHeadings(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .filter((line) => line !== UNRELEASED && headingVersion(line) === undefined);
}

// Returns each version number that has more than one section.
function duplicateVersions(markdown: string): string[] {
  const versions = markdown.split('\n').flatMap((line) => headingVersion(line) ?? []);
  return [...new Set(versions.filter((version, index) => versions.indexOf(version) !== index))];
}

// Returns the issue and pull request numbers that the section of a version links.
// Returns undefined when the changelog has no dated section for that version.
function sectionLinks(markdown: string, version: string): number[] | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => headingVersion(line) === version);
  if (start === -1) {
    return undefined;
  }
  const next = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const body = lines.slice(start + 1, next === -1 ? undefined : next).join('\n');
  return [...new Set([...body.matchAll(LINK)].map((match) => Number(match[1])))];
}

// An absent file reads as empty text. The existence test reports it.
const changelog = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : '';

describe('CHANGELOG.md format', () => {
  it('should_find_the_changelog_when_repo_root_is_read', () => {
    expect(existsSync(CHANGELOG)).toBe(true);
  });

  it('should_hold_an_unreleased_section_when_changelog_is_read', () => {
    expect(changelog.split('\n')).toContain(UNRELEASED);
  });

  it('should_list_no_bad_heading_when_every_version_has_number_and_date', () => {
    expect(badHeadings(changelog)).toEqual([]);
  });

  it('should_report_the_heading_when_a_version_has_no_date', () => {
    const wrong = `${UNRELEASED}\n\n## [0.1.0]\n\n## [0.2.0] - 2026-11-15\n`;

    expect(badHeadings(wrong)).toEqual(['## [0.1.0]']);
  });

  it('should_report_the_heading_when_a_version_date_does_not_exist', () => {
    const wrong = `${UNRELEASED}\n\n## [0.1.0] - 2026-13-45\n\n## [0.0.0] - 2026-02-30\n\n## [0.0.1] - 2028-02-29\n`;

    expect(badHeadings(wrong)).toEqual(['## [0.1.0] - 2026-13-45', '## [0.0.0] - 2026-02-30']);
  });

  it('should_report_the_version_when_two_sections_have_the_same_number', () => {
    const twice = `${UNRELEASED}\n\n## [0.1.0] - 2026-11-06\n\n## [0.1.0] - 2026-11-08\n\n## [0.0.0] - 2026-11-01\n`;

    expect(duplicateVersions(twice)).toEqual(['0.1.0']);
  });

  it('should_list_no_duplicate_version_when_changelog_is_read', () => {
    expect(duplicateVersions(changelog)).toEqual([]);
  });

  it('should_hold_a_dated_section_when_a_version_is_released', () => {
    const missing = Object.keys(RELEASED).filter(
      (version) => sectionLinks(changelog, version) === undefined,
    );

    expect(missing).toEqual([]);
  });

  it('should_link_only_the_work_of_its_sprint_when_a_released_section_is_read', () => {
    for (const [version, allowed] of Object.entries(RELEASED)) {
      const foreign = (sectionLinks(changelog, version) ?? []).filter(
        (number) => !allowed.includes(number),
      );

      expect({ version, foreign }).toEqual({ version, foreign: [] });
    }
  });

  it('should_report_the_version_when_its_dated_section_is_missing', () => {
    const cut = `${UNRELEASED}\n\n## [0.0.0] - 2026-11-01\n\n- One ([#1](https://github.com/Hexablock-Suite/hexablock-app/pull/1)).\n`;

    expect(sectionLinks(cut, '0.1.0')).toBeUndefined();
    expect(sectionLinks(cut, '0.0.0')).toEqual([1]);
  });

  it('should_list_the_links_of_the_version_only_when_a_later_section_follows', () => {
    const merged = [
      UNRELEASED,
      '',
      '- Later ([#104](https://github.com/Hexablock-Suite/hexablock-app/issues/104)).',
      '',
      '## [0.1.0] - 2026-11-06',
      '',
      '- Merged late ([#97](https://github.com/Hexablock-Suite/hexablock-app/issues/97)).',
      '- Task ([#67](https://github.com/Hexablock-Suite/hexablock-app/issues/67)), see [#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63).',
      '',
      '## [0.0.0] - 2026-11-01',
      '',
      '- Old ([#1](https://github.com/Hexablock-Suite/hexablock-app/pull/1)).',
    ].join('\n');

    expect(sectionLinks(merged, '0.1.0')).toEqual([97, 67, 63]);
  });
});
