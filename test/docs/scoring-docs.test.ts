/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Board } from '../../src/domain/engine/board';
import { FixedListPieceSource } from '../../src/domain/engine/piece-source';
import { RegionSize } from '../../src/domain/engine/region-size';
import { Resolution } from '../../src/domain/engine/resolution';
import type { IScoringPolicy } from '../../src/domain/engine/scoring-policy';
import { FIT_POINTS_PER_TURN } from '../../src/domain/variants/hexa-fit/fit-scoring';
import { fitStars } from '../../src/domain/variants/hexa-fit/fit-stars';
import { ComboMultiplierDecorator } from '../../src/domain/variants/hexa-lines/combo-multiplier-decorator';
import {
  LinesScoring,
  POINTS_PER_CELL,
  POINTS_PER_LINE,
} from '../../src/domain/variants/hexa-lines/lines-scoring';
import { MergeScoring } from '../../src/domain/variants/hexa-merge/merge-scoring';
import { MergeState } from '../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import type { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import {
  SORT_POINTS_PER_TILE,
  SortScoring,
} from '../../src/domain/variants/hexa-sort/sort-scoring';
import { SortState } from '../../src/domain/variants/hexa-sort/sort-state';
import { squareTopology, type SquareCoord } from '../support/engine/square-topology';
import { repoRoot } from '../support/run-tool';
import { linesState } from '../support/variants/hexa-lines/lines-game';
import { mergeState } from '../support/variants/hexa-merge/merge-game';

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

// Returns the names whose `` `NAME` = value `` text is not in the section.
// The value text is the text that JavaScript writes for the number.
function wrongConstants(section: string, values: Record<string, number>): string[] {
  return Object.entries(values)
    .filter(([name, value]) => !section.includes(`\`${name}\` = ${value}`))
    .map(([name]) => name);
}

// Returns each relative link target of the section that is not a file of the repository.
function brokenLinks(section: string): string[] {
  return [...section.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^[a-z]+:/.test(target))
    .filter((target) => !existsSync(path.join(repoRoot, target)));
}

// The points that a policy gives for the turn that ends in `state`.
function turnScore<TState>(policy: IScoringPolicy<TState>, state: TState): number {
  return policy.score(state, Resolution.resolved(state));
}

// The points of one Lines placement from the real base policy and its decorator.
function linesPoints(cells: number, lines: number, streak: number): number {
  const state = linesState(squareTopology, 1, { tray: [] });
  state.cellsPlaced = cells;
  state.linesCleared = lines;
  state.streak = streak;
  return turnScore(new ComboMultiplierDecorator(new LinesScoring<SquareCoord>()), state);
}

// The points of one Merge slide whose merges make the tiles of `values`.
function mergePoints(values: number[]): number {
  const start = mergeState([]);
  const state = new MergeState(start.board, start.tiles, false, values.map(MergeTile.of));
  return turnScore(new MergeScoring(), state);
}

// The points of one Sort turn that clears stacks of the given tile counts.
function sortPoints(stacks: number[]): number {
  const state = SortState.start({
    board: new Board<ColorStack, SquareCoord, string>(
      squareTopology.region(RegionSize.of(1)),
      squareTopology,
    ),
    source: new FixedListPieceSource([]),
    goalsNeeded: 1,
  });
  state.clearedTiles = stacks;
  return turnScore(new SortScoring<SquareCoord>(), state);
}

// Writes 60000 as «60 000», the way the README writes a number of milliseconds.
function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// The worked examples of the README, each with the result that the scoring code gives.
// The README takes the examples from the scoring tests (issue 104).
function workedExamples(): string[] {
  const lines = [
    [1, 1, 1],
    [1, 2, 1],
    [1, 1, 2],
  ].map(
    ([cells, cleared, streak]) =>
      `\`${cells * POINTS_PER_CELL} + ${POINTS_PER_LINE} × ${cleared} × ${cleared + streak - 1}\` = ` +
      `${linesPoints(cells, cleared, streak)}`,
  );
  const star = { maxMoves: 10, maxElapsedMs: 60_000 };
  const fit = [60_000, 60_001].map((elapsedMs) => {
    const stars = fitStars({ moves: 10, elapsedMs }, [star]);
    return `play of 10 moves and ${grouped(elapsedMs)} ms gets ${stars === 1 ? 'the star' : 'no star'}`;
  });
  return [
    ...lines,
    `\`4 + 8\` = ${mergePoints([4, 8])}`,
    `\`11 × ${SORT_POINTS_PER_TILE}\` = ${sortPoints([11])}`,
    `one star of 10 moves and ${grouped(star.maxElapsedMs)} ms`,
    ...fit,
  ];
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

    expect(wrongConstants(section, constants)).toEqual([]);
  });

  it('should_compare_the_text_that_javascript_writes_when_a_constant_is_a_decimal_or_negative_zero', () => {
    const values = { HALF: 0.5, NONE: -0 };

    expect(wrongConstants('`HALF` = 0.5 and `NONE` = 0.', values)).toEqual([]);
    expect(wrongConstants('`HALF` = 0,5 and `NONE` = -0.', values)).toEqual(['HALF', 'NONE']);
  });

  it('should_find_every_linked_file_when_the_readme_links_the_scoring_code_and_tests', () => {
    const section = scoringSection();

    expect(scoringFiles.filter((file) => !existsSync(path.join(repoRoot, file)))).toEqual([]);
    expect(brokenLinks(section)).toEqual([]);
  });

  it('should_report_the_link_when_its_target_file_does_not_exist', () => {
    const section =
      '[`A`](src/domain/engine/board.ts), [`B`](src/missing.ts), [#59](https://x.test/59)';

    expect(brokenLinks(section)).toEqual(['src/missing.ts']);
  });

  it('should_give_the_result_of_the_scoring_code_when_the_readme_shows_a_worked_example', () => {
    const section = scoringSection().replace(/\s+/g, ' ');

    expect(workedExamples().filter((example) => !section.includes(example))).toEqual([]);
  });

  // D22 accepted the scoring of issue #59 on 2026-11-06. Issue #60 and DS-4 stay open.
  it('should_name_the_accepted_decision_d22_when_the_team_accepted_the_scoring_of_issue_59', () => {
    const section = scoringSection();

    expect(section).toContain('D22');
    expect(section).not.toContain('Propuesta, pendiente del equipo');
    expect(section).toContain('issues/59');
    expect(section).toContain('issues/60');
    expect(section).toContain('DS-4');
  });
});
