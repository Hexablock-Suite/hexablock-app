/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { FIT_POINTS_PER_TURN } from '../../src/domain/variants/hexa-fit/fit-scoring';
import {
  POINTS_PER_CELL,
  POINTS_PER_LINE,
} from '../../src/domain/variants/hexa-lines/lines-scoring';
import { SORT_POINTS_PER_TILE } from '../../src/domain/variants/hexa-sort/sort-scoring';
import { repoRoot } from '../support/run-tool';

// APP-FR-06 (issue 104): the README documents the scoring of each variant.
// The gate reads the README section «Scoring» and checks it against the scoring code.

const variants = ['Hexa Lines', 'Hexa Merge', 'Hexa Sort', 'Hexa Fit'];

const scoringFiles = [
  'src/domain/variants/hexa-lines/lines-scoring.ts',
  'src/domain/variants/hexa-lines/combo-multiplier-decorator.ts',
  'src/domain/variants/hexa-merge/merge-scoring.ts',
  'src/domain/variants/hexa-sort/sort-scoring.ts',
  'src/domain/variants/hexa-fit/fit-scoring.ts',
  'src/domain/variants/hexa-fit/fit-stars.ts',
];

const constants: Record<string, number> = {
  POINTS_PER_CELL,
  POINTS_PER_LINE,
  SORT_POINTS_PER_TILE,
  FIT_POINTS_PER_TURN,
};

// Returns the text of the level-3 section «Scoring», up to the next heading of level 2 or 3.
function scoringSection(): string {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const start = readme.indexOf('\n### Scoring\n');
  if (start < 0) return '';
  const rest = readme.slice(start + 1);
  const end = rest.slice(1).search(/\n#{2,3} /);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

describe('README scoring section', () => {
  it('should_have_a_subsection_per_variant_when_the_readme_documents_the_scoring', () => {
    const section = scoringSection();

    expect(section).not.toBe('');
    expect(variants.filter((variant) => !section.includes(`#### ${variant}`))).toEqual([]);
  });

  it('should_link_every_scoring_file_when_the_readme_documents_the_formulas', () => {
    const section = scoringSection();

    expect(scoringFiles.filter((file) => !section.includes(`](${file})`))).toEqual([]);
  });

  it('should_name_each_constant_with_its_code_value_when_the_readme_documents_the_formulas', () => {
    const section = scoringSection();

    const wrong = Object.entries(constants)
      .filter(([name, value]) => !section.includes(`\`${name}\` = ${value}`))
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });

  it('should_mark_the_values_as_a_proposal_when_the_team_decision_59_is_open', () => {
    const section = scoringSection();

    expect(section).toContain('Propuesta, pendiente del equipo');
    expect(section).toContain('issues/59');
    expect(section).toContain('issues/60');
    expect(section).toContain('DS-4');
  });
});
