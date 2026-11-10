/** @jest-environment node */
import {
  hex,
  HexTopology,
  type HexAxis,
  type HexCoord,
} from '../../../src/domain/engine/hex-topology';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Turns } from '../../../src/domain/engine/turns';

// The real hexagonal topology (issue 153, classes.md decision 17).
// The Merge tests run on it, so this suite pins its whole contract.

const topology = new HexTopology();

// True for the cells of a hexagon of `size` rings around the origin.
function inside(size: number): (c: HexCoord) => boolean {
  const keys = new Set(topology.region(RegionSize.of(size)).cells.map((c) => topology.key(c)));
  return (c) => keys.has(topology.key(c));
}

// The hex distance. The test has its own copy, so it does not trust the code that it checks.
function distance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

describe('hex', () => {
  it('should_store_zero_when_a_value_is_a_negative_zero', () => {
    const c = hex(-0, -0);

    expect(Object.is(c.q, 0)).toBe(true);
    expect(Object.is(c.r, 0)).toBe(true);
    expect(topology.key(c)).toBe(topology.key(hex(0, 0)));
  });

  it('should_throw_a_range_error_when_a_value_is_not_a_safe_integer', () => {
    for (const bad of [0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => hex(bad, 0)).toThrow(RangeError);
      expect(() => hex(bad, 0)).toThrow(`A hex coordinate needs whole numbers, not ${bad}, 0.`);
      expect(() => hex(0, bad)).toThrow(RangeError);
      expect(() => hex(0, bad)).toThrow(`A hex coordinate needs whole numbers, not 0, ${bad}.`);
    }
  });

  it('should_refuse_the_write_and_keep_the_value_when_a_caller_writes_a_field', () => {
    const c = hex(1, 2);

    // `readonly` holds only at compile time. `Reflect.set` stands for a caller that ignores it.
    expect(Reflect.set(c, 'q', 5)).toBe(false);
    expect(c).toEqual({ q: 1, r: 2 });
  });
});

describe('HexTopology', () => {
  it('should_give_six_rotation_steps_and_its_closed_names_when_the_topology_is_read', () => {
    expect(topology.fullTurn().equals(Turns.of(6))).toBe(true);
    expect(topology.axes()).toEqual(['q', 'r', 's']);
    expect(topology.directions()).toEqual([
      'east',
      'west',
      'south-east',
      'north-west',
      'south-west',
      'north-east',
    ]);
  });

  it('should_give_one_key_per_coordinate_when_two_keys_are_compared', () => {
    expect(topology.key(hex(1, -2))).toBe('1,-2');
    expect(topology.key(hex(1, -2))).toBe(topology.key(hex(1, -2)));
    expect(topology.key(hex(-2, 1))).not.toBe(topology.key(hex(1, -2)));
  });

  it('should_give_the_six_neighbors_when_the_neighbors_of_a_cell_are_read', () => {
    expect(topology.neighbors(hex(2, -1))).toEqual([
      hex(3, -1),
      hex(3, -2),
      hex(2, -2),
      hex(1, -1),
      hex(1, 0),
      hex(2, 0),
    ]);
  });

  // `Turns` keeps its number private, so a negative zero shows only through an operation.
  it('should_leave_a_coordinate_in_place_when_the_turn_count_is_a_negative_zero', () => {
    const negativeZero = Turns.of(-0);

    expect(negativeZero.equals(Turns.of(0))).toBe(true);
    expect(topology.rotate(hex(1, 0), negativeZero)).toEqual(hex(1, 0));
    expect(topology.rotate(hex(1, 0), negativeZero)).toEqual(
      topology.rotate(hex(1, 0), Turns.of(0)),
    );
  });

  it('should_turn_a_coordinate_one_sixth_per_step_when_it_rotates', () => {
    const turned = [0, 1, 2, 3, 4, 5, 6, 7, -1].map((n) => topology.rotate(hex(1, 0), Turns.of(n)));

    expect(turned).toEqual([
      hex(1, 0),
      hex(0, 1),
      hex(-1, 1),
      hex(-1, 0),
      hex(0, -1),
      hex(1, -1),
      hex(1, 0),
      hex(0, 1),
      hex(1, -1),
    ]);
  });

  it('should_add_the_offset_when_a_coordinate_translates', () => {
    expect(topology.translate(hex(1, 2), hex(-3, 1))).toEqual(hex(-2, 3));
  });

  it('should_walk_each_axis_from_edge_to_edge_when_a_line_goes_through_the_center', () => {
    const contains = inside(3);

    expect([...topology.line('q', hex(0, 0), contains)]).toEqual([
      hex(-2, 0),
      hex(-1, 0),
      hex(0, 0),
      hex(1, 0),
      hex(2, 0),
    ]);
    expect([...topology.line('r', hex(0, 0), contains)]).toEqual([
      hex(0, -2),
      hex(0, -1),
      hex(0, 0),
      hex(0, 1),
      hex(0, 2),
    ]);
    expect([...topology.line('s', hex(0, 0), contains)]).toEqual([
      hex(-2, 2),
      hex(-1, 1),
      hex(0, 0),
      hex(1, -1),
      hex(2, -2),
    ]);
  });

  it('should_start_at_the_edge_when_a_line_goes_through_an_outer_cell', () => {
    expect([...topology.line('q', hex(1, 1), inside(3))]).toEqual([
      hex(-2, 1),
      hex(-1, 1),
      hex(0, 1),
      hex(1, 1),
    ]);
  });

  it('should_throw_a_range_error_when_a_cast_names_an_axis_that_the_grid_lacks', () => {
    const read = () => [...topology.line('nort' as HexAxis, hex(0, 0), inside(2))];

    expect(read).toThrow(RangeError);
    expect(read).toThrow('The hex grid has no axis nort.');
  });

  it('should_throw_a_range_error_when_a_cast_names_an_object_prototype_member', () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      const read = () => [...topology.line(name as HexAxis, hex(0, 0), inside(2))];

      expect(read).toThrow(RangeError);
      expect(read).toThrow(`The hex grid has no axis ${name}.`);
    }
  });

  it('should_give_only_the_center_when_the_ring_radius_is_zero', () => {
    expect([...topology.ring(hex(3, -1), Radius.of(0))]).toEqual([hex(3, -1)]);
  });

  it('should_give_six_cells_per_radius_at_that_distance_when_a_ring_is_read', () => {
    const center = hex(1, 1);

    for (const radius of [1, 2, 3]) {
      const ring = [...topology.ring(center, Radius.of(radius))];

      expect(ring).toHaveLength(6 * radius);
      expect(new Set(ring.map((c) => topology.key(c))).size).toBe(6 * radius);
      expect(ring.every((c) => distance(c, center) === radius)).toBe(true);
    }
  });

  it('should_give_the_cells_of_a_centered_hexagon_when_a_region_is_read', () => {
    expect(topology.region(RegionSize.of(1)).cells).toEqual([hex(0, 0)]);
    // Size 3 is the Sort board (radius 2), and size 5 is the Lines board (radius 4).
    for (const [size, count] of [
      [2, 7],
      [3, 19],
      [5, 61],
    ] as const) {
      const { cells } = topology.region(RegionSize.of(size));

      expect(cells).toHaveLength(count);
      expect(new Set(cells.map((c) => topology.key(c))).size).toBe(count);
      expect(cells.every((c) => distance(c, hex(0, 0)) < size)).toBe(true);
    }
  });
});
