/** @jest-environment node */
import type { GeometryFactory } from '../../../src/domain/engine/geometry-factory';
import { SquareGeometry } from '../../../src/domain/engine/square-geometry';
import { SquareTopology } from '../../../src/domain/engine/square-topology';
import { TriangleGeometry } from '../../../src/domain/engine/triangle-geometry';
import {
  isUp,
  TriangleTopology,
  type TriangleCoord,
} from '../../../src/domain/engine/triangle-topology';

// The real square and triangle families (issue 160, classes.md decision 17, D11).
// The suite reads each family only through the `GeometryFactory` contract.
interface Family<TCoord> {
  readonly name: string;
  readonly geometry: GeometryFactory<TCoord>;
  readonly topologyClass: new () => object;
  readonly fields: readonly [string, string];
}

// Gives the tests of one family. The result keeps the coordinate type inside it.
function familyTests<TCoord>({
  name,
  geometry,
  topologyClass,
  fields: [first, second],
}: Family<TCoord>): () => void {
  const topology = geometry.createTopology();
  const keyOf = (c: TCoord) => topology.key(c);

  // True when each cell reaches every other cell through the neighbors of the topology.
  function isConnected(cells: readonly TCoord[]): boolean {
    const keys = new Set(cells.map(keyOf));
    const [start] = cells;
    if (start === undefined) return false;
    const seen = new Set([keyOf(start)]);
    const queue: TCoord[] = [start];
    for (const c of queue) {
      for (const n of topology.neighbors(c)) {
        if (keys.has(keyOf(n)) && !seen.has(keyOf(n))) {
          seen.add(keyOf(n));
          queue.push(n);
        }
      }
    }
    return seen.size === keys.size;
  }

  return () => {
    it('should_create_the_coordinate_when_two_whole_values_are_given', () => {
      expect(geometry.createCoord([2, -1])).toEqual({ [first]: 2, [second]: -1 });
    });

    it('should_throw_a_range_error_when_the_value_count_is_not_two', () => {
      for (const values of [[], [1], [1, 2, 3]]) {
        expect(() => geometry.createCoord(values)).toThrow(RangeError);
        expect(() => geometry.createCoord(values)).toThrow(
          `A ${name} coordinate needs two values, not ${values.length}.`,
        );
      }
    });

    it('should_throw_a_range_error_when_a_value_is_not_a_safe_integer', () => {
      for (const bad of [0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
        expect(() => geometry.createCoord([bad, 0])).toThrow(RangeError);
        expect(() => geometry.createCoord([bad, 0])).toThrow(
          `A ${name} coordinate needs whole numbers, not ${bad}, 0.`,
        );
        expect(() => geometry.createCoord([0, bad])).toThrow(RangeError);
        expect(() => geometry.createCoord([0, bad])).toThrow(
          `A ${name} coordinate needs whole numbers, not 0, ${bad}.`,
        );
      }
    });

    it('should_store_zero_when_a_value_is_a_negative_zero', () => {
      const c = geometry.createCoord([-0, -0]);

      expect(Object.values(c as object).every((value) => Object.is(value, 0))).toBe(true);
      expect(keyOf(c)).toBe(keyOf(geometry.createCoord([0, 0])));
    });

    it('should_refuse_the_write_and_keep_the_value_when_a_caller_writes_a_field', () => {
      const c = geometry.createCoord([1, 2]);

      // `readonly` holds only at compile time. `Reflect.set` stands for a caller that ignores it.
      expect(Reflect.set(c as object, first, 5)).toBe(false);
      expect(c).toEqual({ [first]: 1, [second]: 2 });
    });

    it('should_give_the_topology_of_the_family_when_the_topology_is_created', () => {
      expect(geometry.createTopology()).toBeInstanceOf(topologyClass);
    });

    it('should_give_connected_shapes_of_one_to_five_cells_when_the_piece_shapes_are_created', () => {
      const shapes = geometry.createPieceShapes();

      expect(shapes.map((shape) => shape.area()).toSorted()).toEqual([1, 2, 3, 3, 4, 4, 5]);
      for (const shape of shapes) {
        const cells = shape.cells();

        expect(new Set(cells.map(keyOf)).size).toBe(shape.area());
        expect(cells).toContainEqual(geometry.createCoord([0, 0]));
        expect(isConnected(cells)).toBe(true);
      }
    });

    it('should_give_different_shapes_when_the_piece_shapes_are_created', () => {
      const names = geometry
        .createPieceShapes()
        .map((shape) => shape.cells().map(keyOf).toSorted().join(' '));

      expect(new Set(names).size).toBe(names.length);
    });

    it('should_keep_the_list_when_a_caller_changes_a_list_that_it_received', () => {
      const count = geometry.createPieceShapes().length;

      geometry.createPieceShapes().pop();

      expect(geometry.createPieceShapes()).toHaveLength(count);
    });
  };
}

const families = [
  [
    'SquareGeometry',
    familyTests({
      name: 'square',
      geometry: new SquareGeometry(),
      topologyClass: SquareTopology,
      fields: ['col', 'row'],
    }),
  ],
  [
    'TriangleGeometry',
    familyTests({
      name: 'triangle',
      geometry: new TriangleGeometry(),
      topologyClass: TriangleTopology,
      fields: ['col', 'row'],
    }),
  ],
] as const;

describe.each(families)('%s', (_name, tests) => {
  tests();
});

describe('TriangleGeometry piece orientation', () => {
  it('should_hold_as_many_up_as_down_triangles_when_the_piece_shapes_are_counted', () => {
    // A translation keeps the orientation, so the list must be able to fill both kinds of cell.
    const cells: TriangleCoord[] = new TriangleGeometry()
      .createPieceShapes()
      .flatMap((shape) => shape.cells());

    expect(cells.filter(isUp)).toHaveLength(cells.length / 2);
  });
});
