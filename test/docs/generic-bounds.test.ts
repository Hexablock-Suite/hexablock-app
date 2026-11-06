/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

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

// The TypeScript parser reads every type parameter that has a bound, whatever its name,
// for example `TState extends BoardState<…> & Cloneable<TState>` or `K extends CoordKey`.
// The bound text is the source text of the constraint, so an intersection stays whole.
function boundsIn(source: string): Bound[] {
  const file = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
  const bounds: Bound[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeParameterDeclaration(node) && node.constraint !== undefined) {
      bounds.push({ parameter: node.name.text, bound: node.constraint.getText(file) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return bounds;
}

function codeBounds(): Bound[] {
  return readdirSync(engineDir)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => boundsIn(readFileSync(path.join(engineDir, file), 'utf8')));
}

type Row = Bound & { status: string; reason: string };

// The rows of the table under «### Type parameters» that have a bound.
function readmeRows(): Row[] {
  const section = readme.split('### Type parameters')[1]?.split('\n### ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
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

  it('should_find_every_bounded_parameter_when_its_name_does_not_start_with_t', () => {
    const source = [
      'export class Cache<K extends CoordKey, TValue> {',
      '  find<Q extends Iterable<K>>(keys: Q): void {}',
      '}',
      'export function pick<Item extends Cloneable<Item>>(items: Item[]): Item[] {',
      '  return items;',
      '}',
    ].join('\n');

    expect(boundsIn(source)).toEqual([
      { parameter: 'K', bound: 'CoordKey' },
      { parameter: 'Q', bound: 'Iterable<K>' },
      { parameter: 'Item', bound: 'Cloneable<Item>' },
    ]);
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
