/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { repoRoot } from '../support/run-tool';

// APP-NFR-05: every bound on a generic parameter has a row, with its reason, in the README.
// - The table «Type parameters» covers `src/domain/engine/`. A row marked `code` must exist
//   in the engine code, and a row marked `design` is planned for a later sprint.
// - The table «Variant bounds» covers `src/domain/variants/` and its subfolders (issue 124).
//   Its Where column names each place in backticks: a class, a function, or `Class.method`.
//   A `code` row covers a bound only at the places it names, and each place it names
//   must have that bound in the code.
// This scope is a design choice: a bound in the application or an adapter has no row
// and no check here.

const engineDir = path.join(repoRoot, 'src/domain/engine');
const variantsDir = path.join(repoRoot, 'src/domain/variants');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

type Bound = { parameter: string; bound: string };
// A bound and the place that declares its parameter.
type PlacedBound = Bound & { place: string };

const compact = (text: string) => text.replace(/\s+/g, '');
const same = (a: Bound, b: Bound) =>
  a.parameter === b.parameter && compact(a.bound) === compact(b.bound);

// The class, interface, type or function that declares the type parameter,
// or `Class.method` for a method.
function placeOf(parameter: ts.TypeParameterDeclaration): string {
  const owner = parameter.parent;
  const name = ts.getNameOfDeclaration(owner as ts.Declaration)?.getText() ?? '(anonymous)';
  if (ts.isMethodDeclaration(owner) && ts.isClassLike(owner.parent) && owner.parent.name) {
    return `${owner.parent.name.text}.${name}`;
  }
  return name;
}

// The TypeScript parser reads every type parameter that has a bound, whatever its name,
// for example `TState extends BoardState<…> & Cloneable<TState>` or `K extends CoordKey`.
// The bound text is the source text of the constraint, so an intersection stays whole.
function placedBoundsIn(source: string): PlacedBound[] {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  const bounds: PlacedBound[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeParameterDeclaration(node) && node.constraint !== undefined) {
      bounds.push({
        parameter: node.name.text,
        bound: node.constraint.getText(file),
        place: placeOf(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return bounds;
}

function boundsIn(source: string): Bound[] {
  return placedBoundsIn(source).map(({ parameter, bound }) => ({ parameter, bound }));
}

function codeBounds(): Bound[] {
  return readdirSync(engineDir)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => boundsIn(readFileSync(path.join(engineDir, file), 'utf8')));
}

function variantBounds(): PlacedBound[] {
  return readdirSync(variantsDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .flatMap((file) => placedBoundsIn(readFileSync(path.join(variantsDir, file), 'utf8')));
}

type Row = Bound & { where: string; status: string; reason: string };
type VariantRow = Row & { places: string[] };

// `[text](target)` becomes `text`.
const unlink = (cell: string) => cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

// The rows of the table under `### <heading>` that have a bound.
function tableRows(heading: string): Row[] {
  const section = readme.split(`### ${heading}\n`)[1]?.split('\n### ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map(([, parameter = '', , bound = '', where = '', status = '', reason = '']) => ({
      parameter: parameter.replace(/`/g, ''),
      bound: unlink(bound).replace(/`/g, ''),
      where,
      status,
      reason,
    }))
    .filter((row) => row.bound !== 'None');
}

function readmeRows(): Row[] {
  return tableRows('Type parameters');
}

// The places that a Where cell names in backticks, such as `MergeRules` or `Slide.of()`.
function variantRows(): VariantRow[] {
  return tableRows('Variant bounds').map((row) => ({
    ...row,
    places: [...unlink(row.where).matchAll(/`([^`]+)`/g)].map(([, place = '']) =>
      place.replace(/\(\)$/, ''),
    ),
  }));
}

// The bounds that no `code` row lists with the same bound at their place.
function unlisted(bounds: PlacedBound[], rows: VariantRow[]): PlacedBound[] {
  return bounds.filter(
    (bound) =>
      !rows.some(
        (row) => row.status === 'code' && same(row, bound) && row.places.includes(bound.place),
      ),
  );
}

// The places of `code` rows where the code has no such bound.
function unknownPlaces(rows: VariantRow[], bounds: PlacedBound[]): string[] {
  return rows
    .filter((row) => row.status === 'code')
    .flatMap((row) =>
      row.places
        .filter((place) => !bounds.some((bound) => same(row, bound) && bound.place === place))
        .map((place) => `${row.parameter} extends ${row.bound} on ${place}`),
    );
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

  it('should_read_the_whole_bound_when_it_nests_two_levels_of_angle_brackets', () => {
    const source = [
      'export class Store<TState extends BoardState<Map<string, X>>> {}',
      'export function load<TItem extends Map<string, Set<Array<X>>> & Cloneable<TItem>>() {}',
    ].join('\n');

    expect(boundsIn(source)).toEqual([
      { parameter: 'TState', bound: 'BoardState<Map<string, X>>' },
      { parameter: 'TItem', bound: 'Map<string, Set<Array<X>>> & Cloneable<TItem>' },
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

  describe('variant bounds (APP-NFR-05, issue 124)', () => {
    it('should_name_the_class_the_method_or_the_function_when_a_variant_bound_is_read', () => {
      const source = [
        'export class Slide<TAxis extends string> {',
        '  static of<TAxis extends string>(axis: TAxis): void {}',
        '}',
        'function pack<TCell extends IMergeable<TCell>>(tiles: TCell[]): void {}',
        'export class Plain<TCoord> {}',
      ].join('\n');

      expect(placedBoundsIn(source)).toEqual([
        { parameter: 'TAxis', bound: 'string', place: 'Slide' },
        { parameter: 'TAxis', bound: 'string', place: 'Slide.of' },
        { parameter: 'TCell', bound: 'IMergeable<TCell>', place: 'pack' },
      ]);
    });

    it('should_find_the_merge_bounds_when_the_variants_are_scanned', () => {
      const bounds = variantBounds();

      expect(bounds).toContainEqual({
        parameter: 'TCell',
        bound: 'IMergeable<TCell>',
        place: 'MergeRules',
      });
      expect(bounds).toContainEqual({ parameter: 'TAxis', bound: 'string', place: 'MergeRules' });
      expect(bounds).toContainEqual({ parameter: 'TAxis', bound: 'string', place: 'MergeState' });
      expect(bounds).toContainEqual({ parameter: 'TAxis', bound: 'string', place: 'Slide' });
      expect(bounds).toContainEqual({ parameter: 'TAxis', bound: 'string', place: 'linesOf' });
    });

    it('should_report_the_bound_when_no_code_row_names_its_place_with_the_same_bound', () => {
      const row = (parameter: string, bound: string, places: string[], status = 'code') => ({
        parameter,
        bound,
        where: '',
        places,
        status,
        reason: 'A reason.',
      });
      const bounds: PlacedBound[] = [
        { parameter: 'TAxis', bound: 'string', place: 'MergeState' },
        { parameter: 'TAxis', bound: 'string', place: 'Slide' },
        { parameter: 'TCell', bound: 'IMergeable<TCell>', place: 'pack' },
        { parameter: 'TCell', bound: 'IMergeable<TCell>', place: 'MergeRules' },
      ];

      const missing = unlisted(bounds, [
        row('TAxis', 'string', ['MergeState']),
        row('TCell', 'Cloneable<TCell>', ['pack']),
        row('TCell', 'IMergeable<TCell>', ['MergeRules'], 'design'),
      ]);

      expect(missing).toEqual([
        { parameter: 'TAxis', bound: 'string', place: 'Slide' },
        { parameter: 'TCell', bound: 'IMergeable<TCell>', place: 'pack' },
        { parameter: 'TCell', bound: 'IMergeable<TCell>', place: 'MergeRules' },
      ]);
    });

    it('should_list_every_variant_bound_when_the_variant_bounds_table_is_read', () => {
      const rows = variantRows();

      expect(variantBounds().length).toBeGreaterThan(0);
      expect(unlisted(variantBounds(), rows)).toEqual([]);
    });

    it('should_name_no_place_that_lacks_the_bound_when_the_variant_bounds_table_is_read', () => {
      const rows = variantRows();

      expect(rows.length).toBeGreaterThan(0);
      expect(unknownPlaces(rows, variantBounds())).toEqual([]);
    });

    it('should_mark_each_variant_row_as_code_or_design_and_give_a_reason_when_the_table_is_read', () => {
      const rows = variantRows();

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter((row) => !['code', 'design'].includes(row.status))).toEqual([]);
      expect(rows.filter((row) => row.reason === '' || row.places.length === 0)).toEqual([]);
    });
  });

  it('should_mark_each_row_as_code_or_design_and_give_a_reason_when_the_table_is_read', () => {
    const rows = readmeRows();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !['code', 'design'].includes(row.status))).toEqual([]);
    expect(rows.filter((row) => row.reason === '')).toEqual([]);
  });
});
