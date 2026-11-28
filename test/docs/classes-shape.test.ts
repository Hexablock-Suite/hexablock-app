/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

// Issues #458 and #459: the decision list of `docs/architecture/classes.md` keeps its shape.
// A merge resolver once joined decisions 41 to 64 into long lines, and the formatter renumbered them.
// Then a reference such as «decision 64» pointed at another decision (PR #455).
// A decision is a line of the section «Decisions to check with the team» that starts with `N. `.
// A decision line has no indentation. An indented sub-list inside a decision is not a decision.

const CLASSES = 'docs/architecture/classes.md';
const FIXTURES = path.join(repoRoot, 'test/fixtures/docs/classes-shape');
const SECTION = '## Decisions to check with the team';

type Doc = { file: string; text: string };

// A decision line starts with its number, a dot and a space, with no indentation.
const DECISION = /^(\d+)\. /;
// Each decision opens with a bold title, such as `41. **Title.**`.
// So a number, a dot, a space and `**` after other text start a second decision on one line.
// Plain text such as `decision 48. The` does not match, because no bold title follows.
const JOINED_DECISION = /\S\s+(\d+)\. \*\*/;
// Git writes each merge marker at the start of a line.
// The file uses `#` headings, so a line of exactly seven `=` is a marker, not a heading underline.
const MERGE_MARKER = /^(<{7}|\|{7}|={7}|>{7})(\s|$)/;
const TRUNCATED = 'characters truncated';

// The lines of the decision section, each with its line number.
// The section ends at the next heading of the same level.
function sectionLines(text: string): { line: number; value: string }[] {
  const lines = text.split('\n');
  const start = lines.indexOf(SECTION);
  if (start === -1) return [];
  const end = lines.findIndex((value, index) => index > start && value.startsWith('## '));
  return lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .map((value, index) => ({ line: start + 2 + index, value }));
}

// Rule (a): the decisions run from 1 to N, with no gap and no repeat.
function numberingProblems({ file, text }: Doc): string[] {
  const decisions = sectionLines(text).flatMap(({ line, value }) => {
    const number = DECISION.exec(value)?.[1];
    return number === undefined ? [] : [{ line, number: Number(number) }];
  });
  if (decisions.length === 0) return [`${file} has no decision under «${SECTION}»`];
  return decisions.flatMap(({ line, number }, index) =>
    number === index + 1
      ? []
      : [`${file}:${line} has decision ${number}, but decision ${index + 1} comes next`],
  );
}

// Rule (b): no line starts a second decision after other text.
function joinedDecisionProblems({ file, text }: Doc): string[] {
  return sectionLines(text).flatMap(({ line, value }) => {
    const number = JOINED_DECISION.exec(value)?.[1];
    return number === undefined
      ? []
      : [`${file}:${line} starts decision ${number} after other text`];
  });
}

// Rule (c): no line of the file holds a merge marker or the text «characters truncated».
function debrisProblems({ file, text }: Doc): string[] {
  return text.split('\n').flatMap((value, index) => {
    const marker = MERGE_MARKER.exec(value.trimStart())?.[1];
    if (marker !== undefined) return [`${file}:${index + 1} holds the merge marker ${marker}`];
    if (value.toLowerCase().includes(TRUNCATED))
      return [`${file}:${index + 1} holds «${TRUNCATED}»`];
    return [];
  });
}

// Every rule of the shape, in one list.
function shapeProblems(doc: Doc): string[] {
  return [...numberingProblems(doc), ...joinedDecisionProblems(doc), ...debrisProblems(doc)];
}

const read = (file: string): Doc => ({
  file,
  text: readFileSync(path.join(repoRoot, file), 'utf8'),
});
const fixture = (name: string): Doc => ({
  file: name,
  text: readFileSync(path.join(FIXTURES, name), 'utf8'),
});

// Puts one extra line into the valid fixture, as line 9.
// The merge markers stay out of the fixture files, so no merge tool reads them as a conflict.
function validWithLine(line: string): Doc {
  const lines = fixture('valid.md').text.split('\n');
  lines.splice(8, 0, line);
  return { file: 'valid.md', text: lines.join('\n') };
}

describe('shape of the decision list of classes.md', () => {
  it('should_list_no_problem_when_reading_the_real_classes_md', () => {
    expect(shapeProblems(read(CLASSES))).toEqual([]);
  });

  it('should_list_no_numbering_problem_when_the_decisions_run_from_1_to_n', () => {
    expect(numberingProblems(fixture('valid.md'))).toEqual([]);
  });

  it('should_report_the_decision_when_a_number_is_missing', () => {
    expect(numberingProblems(fixture('gap.md'))).toEqual([
      'gap.md:12 has decision 4, but decision 3 comes next',
    ]);
  });

  it('should_report_each_decision_when_a_number_repeats', () => {
    expect(numberingProblems(fixture('repeat.md'))).toEqual([
      'repeat.md:12 has decision 2, but decision 3 comes next',
      'repeat.md:14 has decision 3, but decision 4 comes next',
    ]);
  });

  it('should_report_the_file_when_it_has_no_decision', () => {
    expect(numberingProblems({ file: 'empty.md', text: '# Class diagram\n' })).toEqual([
      `empty.md has no decision under «${SECTION}»`,
    ]);
  });

  it('should_list_no_joined_decision_when_each_decision_starts_its_own_line', () => {
    expect(joinedDecisionProblems(fixture('valid.md'))).toEqual([]);
  });

  it('should_report_the_line_when_it_starts_a_second_decision_after_other_text', () => {
    expect(joinedDecisionProblems(fixture('joined.md'))).toEqual([
      'joined.md:9 starts decision 2 after other text',
    ]);
  });

  it('should_list_no_debris_when_the_file_has_no_merge_marker', () => {
    expect(debrisProblems(fixture('valid.md'))).toEqual([]);
  });

  it.each([
    ['<'.repeat(7) + ' HEAD'],
    ['|'.repeat(7) + ' base'],
    ['='.repeat(7)],
    ['>'.repeat(7) + ' main'],
  ])('should_report_the_line_when_it_holds_a_merge_marker', (marker) => {
    expect(debrisProblems(validWithLine(marker))).toEqual([
      `valid.md:9 holds the merge marker ${marker.slice(0, 7)}`,
    ]);
  });

  it('should_report_the_line_when_it_holds_the_text_characters_truncated', () => {
    expect(debrisProblems(validWithLine('[... 2048 characters truncated ...]'))).toEqual([
      'valid.md:9 holds «characters truncated»',
    ]);
  });
});
