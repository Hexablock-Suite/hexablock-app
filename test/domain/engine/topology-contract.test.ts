/** @jest-environment node */
import type { GridTopology } from '../../../src/domain/engine/grid-topology';
import { hex, HexTopology, type HexCoord } from '../../../src/domain/engine/hex-topology';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import {
  square,
  SquareTopology,
  type SquareAxis,
  type SquareCoord,
  type SquareDirection,
} from '../../../src/domain/engine/square-topology';
import {
  isUp,
  triangle,
  TriangleTopology,
  type TriangleCoord,
} from '../../../src/domain/engine/triangle-topology';
import { Turns } from '../../../src/domain/engine/turns';
import { square as supportSquare, squareTopology } from '../../support/engine/square-topology';
import {
  isUp as supportIsUp,
  triangle as supportTriangle,
  triangleTopology,
} from '../../support/engine/triangle-topology';

// Issue 160: the same `GridTopology` tests run on the three real topologies.
// `region(size)` has a different figure on each topology (Trap of issue 160).
// So each row of the table holds the cell counts of its own topology.
interface Row<TCoord> {
  // The name of the grid in the error messages.
  readonly grid: string;
  // The table erases the closed unions, so a free name stands for a cast name.
  readonly topology: GridTopology<TCoord, string, string>;
  readonly rotationSteps: number;
  readonly axes: readonly string[];
  readonly directions: readonly string[];
  readonly neighborCount: number;
  // The offset that moves nothing.
  readonly origin: TCoord;
  // Different cells, with negative values, in each orientation of the grid.
  readonly samples: readonly TCoord[];
  readonly offsets: readonly TCoord[];
  // One step per direction: the direction, the start cell and the neighbor.
  readonly steps: readonly (readonly [string, TCoord, TCoord])[];
  // One step of rotation: the start cell and the turned cell.
  readonly turn: readonly [TCoord, TCoord];
  // Each pair holds a size and its cell count.
  readonly regionCounts: readonly (readonly [number, number])[];
  // Each pair holds a radius and its cell count.
  readonly ringCounts: readonly (readonly [number, number])[];
}

// A name that the grid lacks, and three names that every object inherits.
const missingNames = ['nort', 'constructor', 'toString', '__proto__'];

// Gives the tests of one row. The result keeps the coordinate type of the row inside it,
// so one table holds three coordinate types with no cast.
function contract<TCoord>(row: Row<TCoord>): () => void {
  const { topology } = row;
  const keyOf = (c: TCoord) => topology.key(c);
  const sortedKeys = (cells: Iterable<TCoord>) => [...cells].map(keyOf).toSorted();
  const areNeighbors = (a: TCoord, b: TCoord) =>
    topology.neighbors(a).map(keyOf).includes(keyOf(b));
  const regionOf = (size: number) => topology.region(RegionSize.of(size)).cells;

  function insideRegion(size: number): (c: TCoord) => boolean {
    const keys = new Set(regionOf(size).map(keyOf));
    return (c) => keys.has(keyOf(c));
  }

  // Walks the neighbors breadth first and gives the frontier at each distance.
  // The test has its own walk, so it does not trust the `ring()` that it checks.
  function frontiers(start: TCoord, allowed: (c: TCoord) => boolean, steps: number): TCoord[][] {
    const seen = new Set([keyOf(start)]);
    const all = [[start]];
    for (let distance = 0; distance < steps; distance += 1) {
      const next: TCoord[] = [];
      for (const c of all[distance] ?? []) {
        for (const n of topology.neighbors(c)) {
          if (allowed(n) && !seen.has(keyOf(n))) {
            seen.add(keyOf(n));
            next.push(n);
          }
        }
      }
      all.push(next);
    }
    return all;
  }

  return () => {
    it('should_declare_its_rotation_steps_axes_and_directions_when_it_is_read', () => {
      expect(topology.fullTurn().equals(Turns.of(row.rotationSteps))).toBe(true);
      expect(topology.axes()).toEqual(row.axes);
      expect(topology.directions()).toEqual(row.directions);
    });

    it('should_give_one_key_per_cell_when_the_keys_of_different_cells_are_compared', () => {
      const keys = row.samples.map(keyOf);

      expect(new Set(keys).size).toBe(row.samples.length);
      expect(row.samples.map(keyOf)).toEqual(keys);
    });

    it('should_give_different_neighbors_that_point_back_when_the_neighbors_are_read', () => {
      for (const c of row.samples) {
        const neighbors = topology.neighbors(c);

        expect(neighbors).toHaveLength(row.neighborCount);
        expect(new Set(neighbors.map(keyOf)).size).toBe(row.neighborCount);
        expect(neighbors.every((n) => areNeighbors(n, c))).toBe(true);
      }
    });

    it('should_reach_each_neighbor_once_when_each_direction_is_followed', () => {
      for (const c of row.samples) {
        const reached = topology.directions().map((d) => topology.neighbor(c, d));

        expect(reached.map(keyOf).toSorted()).toEqual(sortedKeys(topology.neighbors(c)));
      }
    });

    it('should_give_the_cell_of_that_direction_when_one_direction_is_followed', () => {
      for (const [direction, from, to] of row.steps) {
        expect(topology.neighbor(from, direction)).toEqual(to);
      }
    });

    it('should_throw_a_range_error_when_a_cast_names_a_direction_that_the_grid_lacks', () => {
      for (const name of missingNames) {
        const follow = () => topology.neighbor(row.origin, name);

        expect(follow).toThrow(RangeError);
        expect(follow).toThrow(`The ${row.grid} grid has no direction ${name}.`);
      }
    });

    it('should_throw_a_range_error_when_a_cast_names_an_axis_that_the_grid_lacks', () => {
      for (const name of missingNames) {
        const read = () => [...topology.line(name, row.origin, insideRegion(2))];

        expect(read).toThrow(RangeError);
        expect(read).toThrow(`The ${row.grid} grid has no axis ${name}.`);
      }
    });

    it('should_give_the_expected_cell_when_a_cell_turns_one_step', () => {
      const [from, to] = row.turn;

      expect(topology.rotate(from, Turns.of(1))).toEqual(to);
    });

    it('should_return_to_the_start_when_a_cell_turns_whole_turns', () => {
      for (const c of row.samples) {
        for (const turns of [row.rotationSteps, -row.rotationSteps, 2 * row.rotationSteps]) {
          expect(topology.rotate(c, Turns.of(turns))).toEqual(c);
        }
      }
    });

    it('should_undo_the_turn_when_a_cell_turns_back_the_same_steps', () => {
      for (const c of row.samples) {
        for (let steps = 1; steps < row.rotationSteps; steps += 1) {
          const turned = topology.rotate(c, Turns.of(steps));

          expect(topology.rotate(turned, Turns.of(-steps))).toEqual(c);
        }
      }
    });

    it('should_keep_two_cells_neighbors_when_both_turn_one_step', () => {
      for (const c of row.samples) {
        for (const n of topology.neighbors(c)) {
          const turnedCell = topology.rotate(c, Turns.of(1));
          const turnedNeighbor = topology.rotate(n, Turns.of(1));

          expect(areNeighbors(turnedCell, turnedNeighbor)).toBe(true);
        }
      }
    });

    it('should_keep_the_cell_when_the_offset_is_the_origin', () => {
      for (const c of row.samples) {
        expect(topology.translate(c, row.origin)).toEqual(c);
      }
    });

    it('should_keep_two_cells_neighbors_when_both_translate_by_one_offset', () => {
      for (const c of row.samples) {
        for (const n of topology.neighbors(c)) {
          for (const offset of row.offsets) {
            const movedCell = topology.translate(c, offset);
            const movedNeighbor = topology.translate(n, offset);

            expect(areNeighbors(movedCell, movedNeighbor)).toBe(true);
          }
        }
      }
    });

    it('should_walk_one_chain_of_neighbors_when_a_line_follows_each_axis', () => {
      const inside = insideRegion(3);

      for (const axis of topology.axes()) {
        for (const through of regionOf(3)) {
          const line = [...topology.line(axis, through, inside)];

          expect(line.map(keyOf)).toContain(keyOf(through));
          expect(new Set(line.map(keyOf)).size).toBe(line.length);
          expect(line.every(inside)).toBe(true);
          expect(line.slice(1).every((c, i) => areNeighbors(c, line[i] as TCoord))).toBe(true);
          // A line through any of its cells is the same line.
          for (const c of line) expect([...topology.line(axis, c, inside)]).toEqual(line);
        }
      }
    });

    it('should_give_only_the_center_when_the_ring_radius_is_zero', () => {
      for (const c of row.samples) {
        expect([...topology.ring(c, Radius.of(0))]).toEqual([c]);
      }
    });

    it('should_give_the_cells_at_that_distance_when_a_ring_is_read', () => {
      for (const c of row.samples) {
        for (const [radius, count] of row.ringCounts) {
          const ring = [...topology.ring(c, Radius.of(radius))];

          expect(ring).toHaveLength(count);
          expect(sortedKeys(ring)).toEqual(
            sortedKeys(frontiers(c, () => true, radius)[radius] ?? []),
          );
        }
      }
    });

    it('should_give_the_count_of_its_own_figure_when_a_region_is_read', () => {
      for (const [size, count] of row.regionCounts) {
        const cells = regionOf(size);
        const [first] = cells;
        const reached = first === undefined ? [] : frontiers(first, insideRegion(size), count);

        expect(cells).toHaveLength(count);
        expect(new Set(cells.map(keyOf)).size).toBe(count);
        // The region is connected, so the walk reaches every cell.
        expect(reached.flat()).toHaveLength(count);
      }
    });
  };
}

const table = [
  [
    'hex',
    contract<HexCoord>({
      grid: 'hex',
      topology: new HexTopology(),
      rotationSteps: 6,
      axes: ['q', 'r', 's'],
      directions: ['east', 'west', 'south-east', 'north-west', 'south-west', 'north-east'],
      neighborCount: 6,
      origin: hex(0, 0),
      samples: [hex(0, 0), hex(1, 0), hex(2, -1), hex(-3, 2)],
      offsets: [hex(1, 0), hex(0, 1), hex(-2, 3)],
      steps: [
        ['east', hex(1, 1), hex(2, 1)],
        ['west', hex(1, 1), hex(0, 1)],
        ['south-east', hex(1, 1), hex(1, 2)],
        ['north-west', hex(1, 1), hex(1, 0)],
        ['south-west', hex(1, 1), hex(0, 2)],
        ['north-east', hex(1, 1), hex(2, 0)],
      ],
      turn: [hex(1, 0), hex(0, 1)],
      // A hexagon: the cells at distance `size - 1` or less. Size 5 is radius 4, 61 cells.
      regionCounts: [
        [1, 1],
        [2, 7],
        [3, 19],
        [5, 61],
      ],
      ringCounts: [
        [1, 6],
        [2, 12],
        [3, 18],
      ],
    }),
  ],
  [
    'square',
    contract<SquareCoord>({
      grid: 'square',
      topology: new SquareTopology(),
      rotationSteps: 4,
      axes: ['col', 'row'],
      directions: ['north', 'east', 'south', 'west'],
      neighborCount: 4,
      origin: square(0, 0),
      samples: [square(0, 0), square(1, 0), square(2, -1), square(-3, 2)],
      offsets: [square(1, 0), square(0, 1), square(-2, 3)],
      steps: [
        ['north', square(1, 1), square(1, 0)],
        ['east', square(1, 1), square(2, 1)],
        ['south', square(1, 1), square(1, 2)],
        ['west', square(1, 1), square(0, 1)],
      ],
      turn: [square(1, 0), square(0, 1)],
      // A square of size × size cells.
      regionCounts: [
        [1, 1],
        [2, 4],
        [3, 9],
        [5, 25],
      ],
      ringCounts: [
        [1, 4],
        [2, 8],
        [3, 12],
      ],
    }),
  ],
  [
    'triangle',
    contract<TriangleCoord>({
      grid: 'triangle',
      topology: new TriangleTopology(),
      rotationSteps: 6,
      axes: ['row', 'down-right', 'down-left'],
      directions: ['left', 'right', 'vertical'],
      neighborCount: 3,
      origin: triangle(0, 0),
      samples: [triangle(0, 0), triangle(1, 0), triangle(-3, 2), triangle(2, -5)],
      // An odd offset flips the orientation when code adds the components (decision 16).
      offsets: [triangle(1, 0), triangle(0, 1), triangle(-2, 3)],
      steps: [
        ['left', triangle(0, 0), triangle(-1, 0)],
        ['right', triangle(0, 0), triangle(1, 0)],
        ['vertical', triangle(0, 0), triangle(0, 1)],
        ['vertical', triangle(1, 0), triangle(1, -1)],
      ],
      // The center of the turn is a vertex, so no triangle stays in its place.
      turn: [triangle(0, 0), triangle(1, 0)],
      // A rhombus of size × size lattice cells, two triangles each.
      regionCounts: [
        [1, 2],
        [2, 8],
        [3, 18],
        [5, 50],
      ],
      ringCounts: [
        [1, 3],
        [2, 6],
        [3, 9],
      ],
    }),
  ],
] as const;

describe.each(table)('GridTopology contract on the %s topology', (_name, tests) => {
  tests();
});

// `test/support/engine/` keeps the names of the doubles, and holds no second implementation.
describe('test support topologies', () => {
  it('should_give_the_real_coordinate_functions_when_the_support_modules_are_imported', () => {
    expect(supportSquare).toBe(square);
    expect(supportTriangle).toBe(triangle);
    expect(supportIsUp).toBe(isUp);
  });

  it('should_keep_every_member_when_a_test_spreads_a_support_topology', () => {
    const copy: GridTopology<SquareCoord, SquareAxis, SquareDirection> = { ...squareTopology };
    const real = new SquareTopology();

    expect(copy.fullTurn().equals(real.fullTurn())).toBe(true);
    expect(copy.neighbors(square(0, 0))).toEqual(real.neighbors(square(0, 0)));
    expect(copy.neighbor(square(0, 0), 'east')).toEqual(square(1, 0));
    expect([...copy.line('col', square(0, 0), (c) => c.col < 2 && c.col >= 0)]).toEqual([
      square(0, 0),
      square(1, 0),
    ]);
    expect(copy.rotate(square(1, 0), Turns.of(1))).toEqual(real.rotate(square(1, 0), Turns.of(1)));
  });

  it('should_throw_a_range_error_when_a_support_topology_gets_an_inherited_axis_name', () => {
    for (const name of missingNames) {
      const squareLine = () => [
        ...squareTopology.line(name as SquareAxis, square(0, 0), (c) => c.col === 0),
      ];
      const triangleLine = () => [
        ...triangleTopology.line(name as 'row', triangle(0, 0), (c) => c.col === 0),
      ];

      expect(squareLine).toThrow(RangeError);
      expect(triangleLine).toThrow(RangeError);
    }
  });
});
