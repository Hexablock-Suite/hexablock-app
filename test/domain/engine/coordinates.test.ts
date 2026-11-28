/** @jest-environment node */
import { Distance } from '../../../src/domain/engine/geometry/distance';
import { hex, HexCoord, HexTopology } from '../../../src/domain/engine/geometry/hex-topology';
import { Radius } from '../../../src/domain/engine/geometry/radius';
import { RegionSize } from '../../../src/domain/engine/geometry/region-size';
import {
  square,
  SquareCoord,
  SquareTopology,
} from '../../../src/domain/engine/geometry/square-topology';
import {
  triangle,
  TriangleCoord,
  TriangleTopology,
} from '../../../src/domain/engine/geometry/triangle-topology';
import { deliveries } from '../../support/engine/value-receiver';
import { delivered } from '../../support/engine/value-receiver';

// Issue 206 (classes.md decision 44): a coordinate is a value object.
// It keeps its numbers private, compares by value and does the calculations on its own values.
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.

// Pairs of whole numbers. The tests build each expected coordinate from these numbers,
// so they do not trust the operation that they check.
const pairs: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [2, -3],
  [-4, 1],
  [-2, -2],
  [5, 7],
];

// A line of whole numbers: one step forward adds 1, and one step backward takes 1 away.
// `Radius` and `RegionSize` walk any axis, so the tests read their walks on this line.
const numberLine = {
  forward: (from: number) => from + 1,
  backward: (from: number) => from - 1,
};

describe('HexCoord', () => {
  it('should_be_equal_when_two_coordinates_hold_the_same_values', () => {
    expect(hex(2, -3).equals(hex(2, -3))).toBe(true);
    expect(hex(0, 0).equals(hex(-0, -0))).toBe(true);
    expect(hex(2, -3)).toBeInstanceOf(HexCoord);
    expect(HexCoord.of(2, -3).equals(hex(2, -3))).toBe(true);
  });

  it('should_not_be_equal_when_two_coordinates_differ_in_one_value', () => {
    expect(hex(2, -3).equals(hex(1, -3))).toBe(false);
    expect(hex(1, -3).equals(hex(2, -3))).toBe(false);
    expect(hex(2, -3).equals(hex(2, -2))).toBe(false);
    expect(hex(2, -2).equals(hex(2, -3))).toBe(false);
  });

  it('should_give_the_sum_of_each_value_when_two_coordinates_are_added', () => {
    for (const [aq, ar] of pairs) {
      for (const [bq, br] of pairs) {
        const a = hex(aq, ar);

        expect(a.plus(hex(bq, br)).equals(hex(aq + bq, ar + br))).toBe(true);
        expect(a.equals(hex(aq, ar))).toBe(true);
      }
    }
  });

  it('should_give_the_negative_of_each_value_when_the_opposite_is_read', () => {
    for (const [q, r] of pairs) {
      expect(hex(q, r).opposite().equals(hex(-q, -r))).toBe(true);
      expect(hex(q, r).plus(hex(q, r).opposite()).equals(hex(0, 0))).toBe(true);
    }
  });

  it('should_give_the_count_of_steps_between_two_cells_when_the_distance_is_read', () => {
    for (const [aq, ar] of pairs) {
      for (const [bq, br] of pairs) {
        const dq = aq - bq;
        const dr = ar - br;
        const steps = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;

        expect(hex(aq, ar).distanceTo(hex(bq, br)).equals(Distance.of(steps))).toBe(true);
      }
    }
    expect(hex(0, 0).distanceTo(hex(2, -1)).equals(Distance.of(2))).toBe(true);
    expect(hex(1, 1).distanceTo(hex(1, 1)).equals(Distance.of(0))).toBe(true);
  });

  it('should_map_q_r_to_minus_r_and_q_plus_r_when_the_coordinate_turns_one_step', () => {
    for (const [q, r] of pairs) {
      expect(
        hex(q, r)
          .turned()
          .equals(hex(-r, q + r)),
      ).toBe(true);
    }
  });

  // Issue #237: the coordinate gives its key to its topology, and the topology reads no text.
  it('should_give_its_two_values_as_its_key_when_the_topology_asks_for_the_key', () => {
    expect(delivered(hex(1, -2).key())).toBe('1,-2');
    expect(delivered(hex(-0, 3).key())).toBe('0,3');
    expect(delivered(new HexTopology().key(hex(1, -2)))).toBe('1,-2');
  });

  // Issue #165: a screen layout of layer 4 places a cell from its two values.
  // The coordinate gives them to a receiver once and returns nothing.
  it('should_give_its_two_values_to_the_receiver_when_it_delivers_them', () => {
    for (const [q, r] of pairs) {
      expect(deliveries(hex(q, r))).toEqual([[q, r]]);
    }
    const [[first, second]] = deliveries(hex(-0, 3));

    expect(Object.is(first, 0)).toBe(true);
    expect(second).toBe(3);
    expect(hex(1, 2).deliverTo({ receive: () => undefined })).toBeUndefined();
  });

  // Issue #237: no operation returns the values as text, `toString()` included.
  it('should_give_no_text_when_a_template_literal_or_string_converts_the_coordinate', () => {
    expect(`${String(hex(1, -2))}`).toBe('[object Object]');
  });

  it('should_refuse_the_write_when_a_caller_writes_a_private_value', () => {
    const c = hex(1, 2);

    expect(Object.isFrozen(c)).toBe(true);
    expect(Reflect.set(c, 'q', 5)).toBe(false);
    expect(c.equals(hex(1, 2))).toBe(true);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_a_value_of_the_coordinate', () => {
    const c = hex(1, 2);

    // @ts-expect-error `q` is private: a caller asks the coordinate through an operation.
    expect(() => c.q).not.toThrow();
    // @ts-expect-error `r` is private: a caller asks the coordinate through an operation.
    expect(() => c.r).not.toThrow();
  });
});

describe('SquareCoord', () => {
  it('should_be_equal_when_two_coordinates_hold_the_same_values', () => {
    expect(square(2, -3).equals(square(2, -3))).toBe(true);
    expect(square(0, 0).equals(square(-0, -0))).toBe(true);
    expect(square(2, -3)).toBeInstanceOf(SquareCoord);
    expect(SquareCoord.of(2, -3).equals(square(2, -3))).toBe(true);
  });

  it('should_not_be_equal_when_two_coordinates_differ_in_one_value', () => {
    expect(square(2, -3).equals(square(1, -3))).toBe(false);
    expect(square(1, -3).equals(square(2, -3))).toBe(false);
    expect(square(2, -3).equals(square(2, -2))).toBe(false);
    expect(square(2, -2).equals(square(2, -3))).toBe(false);
  });

  it('should_give_the_sum_and_the_opposite_of_each_value_when_they_are_read', () => {
    for (const [ac, ar] of pairs) {
      for (const [bc, br] of pairs) {
        expect(
          square(ac, ar)
            .plus(square(bc, br))
            .equals(square(ac + bc, ar + br)),
        ).toBe(true);
      }
      expect(square(ac, ar).opposite().equals(square(-ac, -ar))).toBe(true);
    }
  });

  // Issue #243: the distance of the four neighbors, the sum of the two differences.
  it('should_give_the_count_of_steps_between_two_cells_when_the_distance_is_read', () => {
    for (const [ac, ar] of pairs) {
      for (const [bc, br] of pairs) {
        const steps = Math.abs(ac - bc) + Math.abs(ar - br);

        expect(square(ac, ar).distanceTo(square(bc, br)).equals(Distance.of(steps))).toBe(true);
      }
    }
    expect(square(0, 0).distanceTo(square(2, -1)).equals(Distance.of(3))).toBe(true);
    expect(square(1, 1).distanceTo(square(1, 1)).equals(Distance.of(0))).toBe(true);
  });

  it('should_map_col_row_to_minus_row_and_col_when_the_coordinate_turns_one_step', () => {
    for (const [col, row] of pairs) {
      expect(square(col, row).turned().equals(square(-row, col))).toBe(true);
    }
  });

  // Issue #237: the coordinate gives its key to its topology, and the topology reads no text.
  it('should_give_its_two_values_as_its_key_when_the_topology_asks_for_the_key', () => {
    expect(delivered(square(1, -2).key())).toBe('1,-2');
    expect(delivered(square(-0, 3).key())).toBe('0,3');
    expect(delivered(new SquareTopology().key(square(1, -2)))).toBe('1,-2');
  });

  // Issue #165: a screen layout of layer 4 places a cell from its two values.
  // The coordinate gives them to a receiver once and returns nothing.
  it('should_give_its_two_values_to_the_receiver_when_it_delivers_them', () => {
    for (const [col, row] of pairs) {
      expect(deliveries(square(col, row))).toEqual([[col, row]]);
    }
    const [[first, second]] = deliveries(square(-0, 3));

    expect(Object.is(first, 0)).toBe(true);
    expect(second).toBe(3);
    expect(square(1, 2).deliverTo({ receive: () => undefined })).toBeUndefined();
  });

  // Issue #237: no operation returns the values as text, `toString()` included.
  it('should_give_no_text_when_a_template_literal_or_string_converts_the_coordinate', () => {
    expect(`${String(square(1, -2))}`).toBe('[object Object]');
  });

  it('should_refuse_the_write_when_a_caller_writes_a_private_value', () => {
    const c = square(1, 2);

    expect(Object.isFrozen(c)).toBe(true);
    expect(Reflect.set(c, 'col', 5)).toBe(false);
    expect(c.equals(square(1, 2))).toBe(true);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_a_value_of_the_coordinate', () => {
    const c = square(1, 2);

    // @ts-expect-error `col` is private: a caller asks the coordinate through an operation.
    expect(() => c.col).not.toThrow();
    // @ts-expect-error `row` is private: a caller asks the coordinate through an operation.
    expect(() => c.row).not.toThrow();
  });
});

describe('TriangleCoord', () => {
  it('should_be_equal_when_two_coordinates_hold_the_same_values', () => {
    expect(triangle(2, -3).equals(triangle(2, -3))).toBe(true);
    expect(triangle(0, 0).equals(triangle(-0, -0))).toBe(true);
    expect(triangle(2, -3)).toBeInstanceOf(TriangleCoord);
    expect(TriangleCoord.of(2, -3).equals(triangle(2, -3))).toBe(true);
  });

  it('should_not_be_equal_when_two_coordinates_differ_in_one_value', () => {
    expect(triangle(2, -3).equals(triangle(1, -3))).toBe(false);
    expect(triangle(1, -3).equals(triangle(2, -3))).toBe(false);
    expect(triangle(2, -3).equals(triangle(2, -2))).toBe(false);
    expect(triangle(2, -2).equals(triangle(2, -3))).toBe(false);
  });

  it('should_point_up_when_the_sum_of_its_values_is_even', () => {
    for (const [col, row] of pairs) {
      expect(triangle(col, row).isUp()).toBe(Math.abs(col + row) % 2 === 0);
    }
    expect(triangle(-1, 0).isUp()).toBe(false);
    expect(triangle(-1, -1).isUp()).toBe(true);
  });

  it('should_give_the_triangle_one_step_away_when_a_side_is_read', () => {
    for (const [col, row] of pairs) {
      const c = triangle(col, row);

      expect(c.left().equals(triangle(col - 1, row))).toBe(true);
      expect(c.right().equals(triangle(col + 1, row))).toBe(true);
      expect(c.above().equals(triangle(col, row - 1))).toBe(true);
      expect(c.below().equals(triangle(col, row + 1))).toBe(true);
    }
  });

  it('should_keep_its_orientation_when_it_moves_by_an_offset_of_lattice_cells', () => {
    for (const [col, row] of pairs) {
      for (const [dc, dr] of pairs) {
        const moved = triangle(col, row).translated(triangle(dc, dr));

        expect(moved.equals(triangle(col + 2 * dc + dr, row + dr))).toBe(true);
        expect(moved.isUp()).toBe(triangle(col, row).isUp());
      }
    }
  });

  it('should_change_its_orientation_and_come_back_after_six_steps_when_it_turns', () => {
    expect(triangle(0, 0).turned().equals(triangle(1, 0))).toBe(true);
    for (const [col, row] of pairs) {
      const start = triangle(col, row);
      let c = start;
      for (let step = 0; step < 6; step += 1) {
        expect(c.turned().isUp()).toBe(!c.isUp());
        c = c.turned();
      }

      expect(c.equals(start)).toBe(true);
    }
  });

  // Issue #237: the coordinate gives its key to its topology, and the topology reads no text.
  it('should_give_its_two_values_as_its_key_when_the_topology_asks_for_the_key', () => {
    expect(delivered(triangle(1, -2).key())).toBe('1,-2');
    expect(delivered(triangle(-0, 3).key())).toBe('0,3');
    expect(delivered(new TriangleTopology().key(triangle(1, -2)))).toBe('1,-2');
  });

  // Issue #165: a screen layout of layer 4 places a cell from its two values.
  // The coordinate gives them to a receiver once and returns nothing.
  it('should_give_its_two_values_to_the_receiver_when_it_delivers_them', () => {
    for (const [col, row] of pairs) {
      expect(deliveries(triangle(col, row))).toEqual([[col, row]]);
    }
    const [[first, second]] = deliveries(triangle(-0, 3));

    expect(Object.is(first, 0)).toBe(true);
    expect(second).toBe(3);
    expect(triangle(1, 2).deliverTo({ receive: () => undefined })).toBeUndefined();
  });

  // Issue #237: no operation returns the values as text, `toString()` included.
  it('should_give_no_text_when_a_template_literal_or_string_converts_the_coordinate', () => {
    expect(`${String(triangle(1, -2))}`).toBe('[object Object]');
  });

  it('should_refuse_the_write_when_a_caller_writes_a_private_value', () => {
    const c = triangle(1, 2);

    expect(Object.isFrozen(c)).toBe(true);
    expect(Reflect.set(c, 'col', 5)).toBe(false);
    expect(c.equals(triangle(1, 2))).toBe(true);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_a_value_of_the_coordinate', () => {
    const c = triangle(1, 2);

    // @ts-expect-error `col` is private: a caller asks the coordinate through an operation.
    expect(() => c.col).not.toThrow();
    // @ts-expect-error `row` is private: a caller asks the coordinate through an operation.
    expect(() => c.row).not.toThrow();
  });
});

describe('Radius', () => {
  // Issue #243: the offsets are the cells of an axis, not numbers.
  it('should_give_each_cell_from_minus_the_radius_to_the_radius_along_the_axis_when_the_offsets_are_read', () => {
    expect([...Radius.of(0).offsets(0, numberLine)]).toEqual([0]);
    expect([...Radius.of(2).offsets(0, numberLine)]).toEqual([-2, -1, 0, 1, 2]);
    expect([...Radius.of(2).offsets(10, numberLine)]).toEqual([8, 9, 10, 11, 12]);
  });

  it('should_tell_if_a_distance_is_the_radius_when_a_distance_is_measured', () => {
    expect(Radius.of(2).measures(Distance.of(2))).toBe(true);
    expect(Radius.of(2).measures(Distance.of(1))).toBe(false);
    expect(Radius.of(2).measures(Distance.of(3))).toBe(false);
    expect(Radius.of(0).measures(Distance.of(-0))).toBe(true);
  });

  it('should_run_the_step_once_per_unit_of_the_radius_when_a_start_is_expanded', () => {
    const grow = (text: string) => `${text}+`;

    expect(Radius.of(0).expand('c', grow)).toBe('c');
    expect(Radius.of(3).expand('c', grow)).toBe('c+++');
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_number_of_the_radius', () => {
    const radius = Radius.of(2);

    // @ts-expect-error `value` is private: a topology asks the radius through an operation.
    expect(() => radius.value).not.toThrow();
  });
});

describe('RegionSize', () => {
  // Issue #243: the indexes and the offsets are the cells of an axis, not numbers.
  it('should_give_one_cell_per_index_from_the_start_when_the_indexes_are_read', () => {
    expect([...RegionSize.of(1).indexes(0, numberLine)]).toEqual([0]);
    expect([...RegionSize.of(3).indexes(0, numberLine)]).toEqual([0, 1, 2]);
    expect([...RegionSize.of(3).indexes(10, numberLine)]).toEqual([10, 11, 12]);
  });

  it('should_give_each_cell_that_is_nearer_than_the_size_along_the_axis_when_the_offsets_are_read', () => {
    expect([...RegionSize.of(1).offsets(0, numberLine)]).toEqual([0]);
    expect([...RegionSize.of(3).offsets(0, numberLine)]).toEqual([-2, -1, 0, 1, 2]);
    expect([...RegionSize.of(3).offsets(10, numberLine)]).toEqual([8, 9, 10, 11, 12]);
  });

  it('should_tell_if_a_distance_is_below_the_size_when_a_distance_is_checked', () => {
    expect(RegionSize.of(3).holds(Distance.of(0))).toBe(true);
    expect(RegionSize.of(3).holds(Distance.of(2))).toBe(true);
    expect(RegionSize.of(3).holds(Distance.of(3))).toBe(false);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_number_of_the_size', () => {
    const size = RegionSize.of(2);

    // @ts-expect-error `value` is private: a topology asks the size through an operation.
    expect(() => size.value).not.toThrow();
  });
});
