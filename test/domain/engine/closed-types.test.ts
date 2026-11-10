/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import type { BoardState } from '../../../src/domain/engine/board-state';
import { Color } from '../../../src/domain/engine/color';
import { coordKey, type CoordKey } from '../../../src/domain/engine/coord-key';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { HexTopology } from '../../../src/domain/engine/hex-topology';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { SquareTopology } from '../../../src/domain/engine/square-topology';
import { TriangleTopology } from '../../../src/domain/engine/triangle-topology';
import { Turns } from '../../../src/domain/engine/turns';
import type { FakeCell } from '../../support/engine/fake-cell';
import { emptyState } from '../../support/engine/fake-game';
import {
  square,
  squareTopology,
  SquareAxis,
  type SquareCoord,
  SquareDirection,
} from '../../support/engine/square-topology';
import {
  triangle,
  triangleTopology,
  TriangleAxis,
  TriangleDirection,
} from '../../support/engine/triangle-topology';
import { BOARD_ID } from '../../support/engine/entity-ids';

// Issue 86: the engine signatures take closed types, not free primitives.
// Issue #207: an axis and a direction are instances of a closed class, so a text does not compile.
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.

describe('closed axis classes', () => {
  it('should_reject_at_compile_time_when_a_board_line_names_an_axis_the_topology_lacks', () => {
    const board = new Board(BOARD_ID, squareTopology.region(RegionSize.of(2)), squareTopology);

    // @ts-expect-error `diagonal` is not an axis of the square topology.
    expect(() => [...board.line('diagonal', square(0, 0))]).toThrow(RangeError);
  });

  it('should_reject_at_compile_time_when_a_topology_line_names_an_axis_of_another_topology', () => {
    // @ts-expect-error `col` is a text, not an axis of the triangle topology.
    expect(() => [...triangleTopology.line('col', triangle(0, 0), () => true)]).toThrow(RangeError);
    const squareAxisOnTriangles = () => [
      // @ts-expect-error `SquareAxis.col` is an axis of the square topology.
      ...triangleTopology.line(SquareAxis.col, triangle(0, 0), () => true),
    ];
    expect(squareAxisOnTriangles).toThrow(new RangeError('The triangle grid has no axis col.'));
  });

  it('should_reject_at_compile_time_when_a_board_line_has_a_misspelled_axis', () => {
    const board = new Board(BOARD_ID, triangleTopology.region(RegionSize.of(2)), triangleTopology);

    // @ts-expect-error `rwo` is not an axis of the triangle topology.
    expect(() => [...board.line('rwo', triangle(0, 0))]).toThrow(RangeError);
  });
});

describe('test double axes and directions', () => {
  it('should_declare_their_own_axes_and_directions_when_the_doubles_are_read', () => {
    const squareAxes: SquareAxis[] = squareTopology.axes();
    const squareDirections: SquareDirection[] = squareTopology.directions();
    const triangleAxes: TriangleAxis[] = triangleTopology.axes();
    const triangleDirections: TriangleDirection[] = triangleTopology.directions();

    expect(squareAxes).toEqual([SquareAxis.col, SquareAxis.row]);
    expect(squareDirections).toEqual([
      SquareDirection.north,
      SquareDirection.east,
      SquareDirection.south,
      SquareDirection.west,
    ]);
    expect(triangleAxes).toEqual([TriangleAxis.row, TriangleAxis.downRight, TriangleAxis.downLeft]);
    expect(triangleDirections).toEqual([
      TriangleDirection.left,
      TriangleDirection.right,
      TriangleDirection.vertical,
    ]);
  });

  it('should_hold_a_board_with_an_axis_class_when_a_board_state_is_typed', () => {
    const board: Board<FakeCell, SquareCoord, SquareAxis> = emptyState(2).board;
    const state: BoardState<FakeCell, SquareCoord> = emptyState(2);

    expect([...board.line(SquareAxis.col, square(0, 1))]).toEqual([square(0, 1), square(1, 1)]);
    expect(state.snapshot().board.shape.cells).toHaveLength(4);
  });
});

describe('Radius', () => {
  it('should_keep_the_value_when_the_radius_is_a_whole_number_of_zero_or_more', () => {
    expect(Radius.of(0).measures(0)).toBe(true);
    expect(Radius.of(3).measures(3)).toBe(true);
    expect(Radius.of(3).measures(2)).toBe(false);
  });

  it('should_throw_a_range_error_when_the_radius_is_negative_or_not_a_whole_number', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => Radius.of(value)).toThrow(RangeError);
      expect(() => Radius.of(value)).toThrow(
        `A radius needs a whole number of zero or more, not ${value}.`,
      );
    }
  });

  it('should_store_zero_when_a_radius_is_negative_zero', () => {
    // `toEqual` tells 0 from a negative zero.
    expect([...Radius.of(-0).offsets()]).toEqual([0]);
  });

  it('should_throw_a_range_error_when_a_radius_is_not_a_safe_integer', () => {
    for (const value of [2 ** 53, Number.MAX_VALUE]) {
      expect(() => Radius.of(value)).toThrow(RangeError);
      expect(() => Radius.of(value)).toThrow(
        `A radius needs a whole number of zero or more, not ${value}.`,
      );
    }
    expect(Radius.of(Number.MAX_SAFE_INTEGER).measures(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('should_give_the_center_when_a_board_ring_has_radius_zero', () => {
    const board = new Board(BOARD_ID, squareTopology.region(RegionSize.of(3)), squareTopology);

    expect([...board.ring(square(1, 1), Radius.of(0))]).toEqual([square(1, 1)]);
  });
});

describe('Color', () => {
  // Issue #129: Lines and Sort share the engine `Color` (classes.md decision 5).
  it('should_keep_the_name_as_written_when_a_color_is_made_from_a_name', () => {
    expect(Color.of('red').equals(Color.of('red'))).toBe(true);
    expect(Color.of(' red').equals(Color.of('red'))).toBe(false);
  });

  it('should_throw_a_range_error_when_the_color_name_is_empty_or_blank', () => {
    for (const name of ['', ' ', '\t']) {
      expect(() => Color.of(name)).toThrow(new RangeError('A color needs a name.'));
    }
  });

  it('should_be_equal_when_two_colors_have_the_same_name', () => {
    const red = Color.of('red');

    expect(red.equals(Color.of('red'))).toBe(true);
    expect(red.equals(red)).toBe(true);
    expect(red.equals(Color.of('blue'))).toBe(false);
    expect(red.equals(Color.of('Red'))).toBe(false);
  });
});

describe('RegionSize', () => {
  it('should_keep_the_value_when_the_size_is_a_whole_number_of_one_or_more', () => {
    expect([...RegionSize.of(1).indexes()]).toEqual([0]);
    expect([...RegionSize.of(5).indexes()]).toEqual([0, 1, 2, 3, 4]);
  });

  it('should_throw_a_range_error_when_the_size_is_below_one_or_not_a_whole_number', () => {
    for (const value of [0, -2, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => RegionSize.of(value)).toThrow(RangeError);
      expect(() => RegionSize.of(value)).toThrow(
        `A region size needs a whole number of one or more, not ${value}.`,
      );
    }
  });

  it('should_throw_a_range_error_when_a_region_size_is_not_a_safe_integer', () => {
    for (const value of [2 ** 53, Number.MAX_VALUE]) {
      expect(() => RegionSize.of(value)).toThrow(RangeError);
      expect(() => RegionSize.of(value)).toThrow(
        `A region size needs a whole number of one or more, not ${value}.`,
      );
    }
    const largest = RegionSize.of(Number.MAX_SAFE_INTEGER);
    expect(largest.holds(Number.MAX_SAFE_INTEGER - 1)).toBe(true);
    expect(largest.holds(Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('should_cover_one_cell_when_the_region_size_is_one', () => {
    expect(squareTopology.region(RegionSize.of(1)).cells).toEqual([square(0, 0)]);
  });
});

describe('Turns', () => {
  it('should_keep_the_value_when_the_count_is_any_whole_number', () => {
    // The count is private, so the test reads it through `equals()` and `plus()`.
    expect(Turns.of(-2).equals(Turns.of(-2))).toBe(true);
    expect(Turns.of(-2).equals(Turns.of(2))).toBe(false);
    expect(Turns.of(0).equals(Turns.of(0))).toBe(true);
    expect(Turns.of(7).plus(Turns.of(-7)).equals(Turns.of(0))).toBe(true);
  });

  it('should_throw_a_range_error_when_the_count_is_not_a_whole_number', () => {
    for (const value of [0.5, -1.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => Turns.of(value)).toThrow(RangeError);
      expect(() => Turns.of(value)).toThrow(`A turn count needs a whole number, not ${value}.`);
    }
  });

  it('should_throw_a_range_error_when_a_turn_count_is_not_a_safe_integer', () => {
    for (const value of [2 ** 53, -(2 ** 53), Number.MAX_VALUE]) {
      expect(() => Turns.of(value)).toThrow(RangeError);
      expect(() => Turns.of(value)).toThrow(`A turn count needs a whole number, not ${value}.`);
    }
    const lowest = Turns.of(Number.MIN_SAFE_INTEGER);
    expect(lowest.plus(Turns.of(Number.MAX_SAFE_INTEGER)).equals(Turns.of(0))).toBe(true);
  });

  it('should_store_zero_when_a_turn_count_is_negative_zero', () => {
    // `toEqual` tells 0 from a negative zero, so it fails when the count keeps the sign.
    expect(Turns.of(-0)).toEqual(Turns.of(0));
  });

  it('should_rotate_backward_when_the_count_is_negative', () => {
    expect(squareTopology.rotate(square(1, 0), Turns.of(-1))).toEqual(square(0, -1));
  });

  // The square topology has 4 rotation steps, and the triangle topology has 6.
  it('should_give_the_same_turn_inside_one_full_turn_when_a_count_is_normalized', () => {
    const normalized = (count: number) => Turns.of(count).normalized(squareTopology);

    expect(normalized(0).equals(Turns.of(0))).toBe(true);
    expect(normalized(3).equals(Turns.of(3))).toBe(true);
    expect(normalized(4).equals(Turns.of(0))).toBe(true);
    expect(normalized(5).equals(Turns.of(1))).toBe(true);
    expect(normalized(-1).equals(Turns.of(3))).toBe(true);
    expect(normalized(-4).equals(Turns.of(0))).toBe(true);
    expect(normalized(-9).equals(Turns.of(3))).toBe(true);
    expect(Turns.of(7).normalized(triangleTopology).equals(Turns.of(1))).toBe(true);
    expect(Turns.of(-1).normalized(triangleTopology).equals(Turns.of(5))).toBe(true);
  });

  it('should_keep_the_first_count_when_a_count_is_normalized', () => {
    const turns = Turns.of(-1);

    turns.normalized(squareTopology);

    expect(turns.equals(Turns.of(-1))).toBe(true);
  });

  // Unit R19 of the redesign: the count stays inside `Turns`, and the topology gives its
  // full turn as a `Turns`. The square topology has 4 rotation steps.
  it('should_give_the_sum_and_keep_both_counts_when_two_counts_are_added', () => {
    const two = Turns.of(2);
    const three = Turns.of(3);

    expect(two.plus(three).equals(Turns.of(5))).toBe(true);
    expect(two.plus(Turns.of(-5)).equals(Turns.of(-3))).toBe(true);
    expect([two.equals(Turns.of(2)), three.equals(Turns.of(3))]).toEqual([true, true]);
    expect(() => Turns.of(Number.MAX_SAFE_INTEGER).plus(Turns.of(1))).toThrow(
      new RangeError(`A turn count needs a whole number, not ${2 ** 53}.`),
    );
  });

  // The positive side of the same guard is in the test above.
  it('should_throw_a_range_error_when_a_sum_of_two_counts_goes_below_the_safe_range', () => {
    const below = () => Turns.of(Number.MIN_SAFE_INTEGER).plus(Turns.of(-1));

    expect(below).toThrow(RangeError);
    expect(below).toThrow('A turn count needs a whole number, not -9007199254740992.');
  });

  it('should_apply_one_step_for_each_step_of_the_normalized_count_when_a_turn_is_applied', () => {
    const stepsOf = (count: number) =>
      Turns.of(count).applyTo(0, (steps) => steps + 1, squareTopology);

    expect([0, 1, 3, 4, 5, -1, -9].map(stepsOf)).toEqual([0, 1, 3, 0, 1, 3, 3]);
    expect(Turns.of(7).applyTo('', (path) => `${path}.`, triangleTopology)).toBe('.');
  });

  it('should_give_each_shorter_count_from_zero_when_the_shorter_turns_are_listed', () => {
    const shorter = [...Turns.of(4).shorter()];
    const expected = [0, 1, 2, 3].map((count) => Turns.of(count));

    expect(shorter).toHaveLength(4);
    expect(shorter.map((turns, index) => turns.equals(expected[index] as Turns))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([...Turns.of(0).shorter()]).toEqual([]);
    expect([...Turns.of(-2).shorter()]).toEqual([]);
  });

  it('should_give_its_full_turn_as_a_turn_count_when_a_topology_is_asked', () => {
    expect(squareTopology.fullTurn().equals(Turns.of(4))).toBe(true);
    expect(triangleTopology.fullTurn().equals(Turns.of(6))).toBe(true);
    expect(new HexGeometry().createTopology().fullTurn().equals(Turns.of(6))).toBe(true);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_number_of_a_turn_count', () => {
    const readers = [
      // @ts-expect-error `Turns.value` is private.
      () => Turns.of(1).value,
      // @ts-expect-error `GridTopology` has no `rotationSteps` number.
      () => squareTopology.rotationSteps,
      // @ts-expect-error `SquareTopology` has no `rotationSteps` number.
      () => new SquareTopology().rotationSteps,
      // @ts-expect-error `TriangleTopology` has no `rotationSteps` number.
      () => new TriangleTopology().rotationSteps,
      // @ts-expect-error `HexTopology` has no `rotationSteps` number.
      () => new HexTopology().rotationSteps,
    ];

    expect(readers).toHaveLength(5);
  });
});

describe('CoordKey', () => {
  it('should_reject_at_compile_time_when_a_free_string_stands_in_for_a_key', () => {
    // @ts-expect-error A free string is not a `CoordKey`.
    const free: CoordKey = '0,0';

    expect(free).toBe('0,0');
  });

  it('should_give_the_same_key_when_two_equal_coordinates_are_keyed', () => {
    const key: CoordKey = squareTopology.key(square(1, 2));

    expect(key).toBe(squareTopology.key(square(1, 2)));
    expect(key).toBe(coordKey('1,2'));
  });
});
