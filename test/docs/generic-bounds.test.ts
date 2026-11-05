/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

// APP-NFR-05: every bound on a generic parameter of the engine has a row,
// with its reason, in the README table «Type parameters». A row marked `code` must exist
// in the engine code, and a row marked `design` is planned for a later sprint.

const engineDir = path.join(repoRoot, 'src/domain/engine');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

type Bound = { parameter: string; bound: string };

const compact = (text: string) => text.replace(/\s+/g, '');
const same = (a: Bound, b: Bound) =>
  a.parameter === b.parameter && compact(a.bound) === compact(b.bound);

// A type parameter is `T` plus a capital letter, for example `TState extends BoardState<…>`.
// A bound can be an intersection, for example `BoardState<…> & Cloneable<TState>`.
const type = String.raw`[A-Za-z]\w*(?:<[^<>]*>)?`;
function codeBounds(): Bound[] {
  const pattern = new RegExp(String.raw`\b(T[A-Z]\w*) extends (${type}(?:\s*&\s*${type})*)`, 'g');
  return readdirSync(engineDir)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) =>
      [...readFileSync(path.join(engineDir, file), 'utf8').matchAll(pattern)].map((m) => ({
        parameter: m[1] ?? '',
        bound: m[2] ?? '',
      })),
    );
}

type Row = Bound & { status: string; reason: string };

// The rows of the table under «### Type parameters» that have a bound.
function readmeRows(): Row[] {
  const section = readme.split('### Type parameters')[1]?.split('\n### ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| `T'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map(([, parameter = '', , bound = '', , status = '', reason = '']) => ({
      parameter: parameter.replace(/`/g, ''),
      bound: bound.replace(/`/g, ''),
      status,
      reason,
    }))
    .filter((row) => row.bound !== 'None');
}

describe('README generic bounds', () => {
  it('should_find_a_bound_in_the_engine_when_the_code_is_scanned', () => {
    expect(codeBounds()).toContainEqual({
      parameter: 'TState',
      bound: 'BoardState<TCell, TCoord> & Cloneable<TState>',
    });
  });

  it('should_list_every_code_bound_when_the_readme_table_is_read', () => {
    const rows = readmeRows().filter((row) => row.status === 'code');

    const missing = codeBounds().filter((bound) => !rows.some((row) => same(row, bound)));

    expect(missing).toEqual([]);
  });

  it('should_list_no_code_row_that_the_engine_lacks_when_the_readme_table_is_read', () => {
    const bounds = codeBounds();

    const extra = readmeRows()
      .filter((row) => row.status === 'code')
      .filter((row) => !bounds.some((bound) => same(row, bound)));

    expect(extra).toEqual([]);
  });

  it('should_mark_each_row_as_code_or_design_and_give_a_reason_when_the_table_is_read', () => {
    const rows = readmeRows();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !['code', 'design'].includes(row.status))).toEqual([]);
    expect(rows.filter((row) => row.reason === '')).toEqual([]);
  });
});
