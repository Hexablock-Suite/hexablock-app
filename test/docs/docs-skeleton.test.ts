/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

const readmeHeadings = [
  'Project Title & Badges',
  'Description',
  'Demo / Screenshots',
  'Architecture',
  'Generic Engine',
  'Design Patterns',
  'SOLID Principles',
  'AOP',
  'Getting Started',
  'Running Tests',
  'AI Usage Documentation',
  'Contributing',
  'License',
];

const aiUsageHeadings = ['Tools Used', 'Usage Log per Task', 'Critical Evaluation'];

// Returns the required level-2 headings that the file does not contain.
function missingHeadings(file: string, required: string[]): string[] {
  const lines = readFileSync(path.join(repoRoot, file), 'utf8').split('\n');
  return required.filter((heading) => !lines.includes(`## ${heading}`));
}

describe('docs skeleton', () => {
  it('should_list_no_missing_heading_when_readme_has_every_required_section', () => {
    expect(missingHeadings('README.md', readmeHeadings)).toEqual([]);
  });

  it('should_list_no_missing_heading_when_ai_usage_has_every_required_section', () => {
    expect(missingHeadings('AI_USAGE.md', aiUsageHeadings)).toEqual([]);
  });

  it('should_find_docs_stubs_when_docs_folder_is_present', () => {
    expect(existsSync(path.join(repoRoot, 'docs/README.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/EXTENSIBILITY.md'))).toBe(true);
  });
});
