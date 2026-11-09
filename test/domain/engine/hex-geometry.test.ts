/** @jest-environment node */
import type { GeometryFactory } from '../../../src/domain/engine/geometry-factory';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { hex, type HexCoord } from '../../../src/domain/engine/hex-topology';

// `HexGeometry` is the real geometry family (issue 153, classes.md decision 17, D11).
// The suite reads it only through the `GeometryFactory` contract.

const geometry: GeometryFactory<HexCoord> = new HexGeometry();

// True when each cell reaches every other cell through the neighbors of the topology.
function isConnected(cells: readonly HexCoord[]): boolean {
  const topology = geometry.createTopology();
  const keys = new Set(cells.map((c) => topology.key(c)));
  const [first] = cells;
  if (first === undefined) return false;
  const seen = new Set([topology.key(first)]);
  const queue = [first];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const n of topology.neighbors(next)) {
      const key = topology.key(n);
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  return seen.size === keys.size;
}

describe('HexGeometry', () => {
  it('should_create_the_coordinate_when_two_whole_values_are_given', () => {
    expect(geometry.createCoord([2, -1])).toEqual(hex(2, -1));
  });

  it('should_throw_a_range_error_when_the_value_count_is_not_two', () => {
    for (const values of [[], [1], [1, 2, 3]]) {
      expect(() => geometry.createCoord(values)).toThrow(RangeError);
      expect(() => geometry.createCoord(values)).toThrow(
        `A hex coordinate needs two values, not ${values.length}.`,
      );
    }
  });

  it('should_throw_a_range_error_when_a_value_is_not_whole', () => {
    expect(() => geometry.createCoord([0.5, 0])).toThrow(RangeError);
    expect(() => geometry.createCoord([0.5, 0])).toThrow(
      'A hex coordinate needs whole numbers, not 0.5, 0.',
    );
  });

  it('should_give_the_hexagonal_topology_when_the_topology_is_created', () => {
    const topology = geometry.createTopology();

    expect(topology.rotationSteps).toBe(6);
    expect(topology.axes()).toEqual(['q', 'r', 's']);
    expect(topology.neighbors(hex(0, 0))).toHaveLength(6);
  });

  it('should_give_connected_shapes_of_one_to_five_cells_when_the_piece_shapes_are_created', () => {
    const shapes = geometry.createPieceShapes();
    const topology = geometry.createTopology();

    expect(shapes.map((shape) => shape.area()).toSorted()).toEqual([1, 2, 3, 3, 4, 4, 5]);
    for (const shape of shapes) {
      const cells = shape.cells();

      expect(new Set(cells.map((c) => topology.key(c))).size).toBe(shape.area());
      expect(cells).toContainEqual(hex(0, 0));
      expect(isConnected(cells)).toBe(true);
    }
  });

  it('should_give_different_shapes_when_the_piece_shapes_are_created', () => {
    const topology = geometry.createTopology();
    const names = geometry.createPieceShapes().map((shape) =>
      shape
        .cells()
        .map((c) => topology.key(c))
        .toSorted()
        .join(' '),
    );

    expect(new Set(names).size).toBe(names.length);
  });

  it('should_keep_the_list_when_a_caller_changes_a_list_that_it_received', () => {
    const count = geometry.createPieceShapes().length;

    geometry.createPieceShapes().pop();

    expect(geometry.createPieceShapes()).toHaveLength(count);
  });
});
