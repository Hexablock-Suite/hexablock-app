/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import type { BoardState } from '../../../src/domain/engine/board-state';
import { coordKey, type CoordKey } from '../../../src/domain/engine/coord-key';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Turns } from '../../../src/domain/engine/turns';
import type { FakeCell } from '../../support/engine/fake-cell';
import { emptyState } from '../../support/engine/fake-game';
import {
  square,
  squareTopology,
  type SquareAxis,
  type SquareCoord,
  type SquareDirection,
} from '../../support/engine/square-topology';
import {
  triangle,
  triangleTopology,
  type TriangleAxis,
  type TriangleDirection,
} from '../../support/engine/triangle-topology';

// Issue 86: the engine signatures take closed types, not free primitives.
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.

describe('closed axis unions', () => {
  it('should_reject_at_compile_time_when_a_board_line_names_an_axis_the_topology_lacks', () => {
    const board = new Board(squareTopology.region(RegionSize.of(2)), squareTopology);

    // @ts-expect-error `diagonal` is not an axis of the square topology.
    expect(() => [...board.line('diagonal', square(0, 0))]).toThrow(RangeError);
  });

  it('should_reject_at_compile_time_when_a_topology_line_names_an_axis_of_another_topology', () => {
    // @ts-expect-error `col` is an axis of the square topology, not of the triangle topology.
    expect(() => [...triangleTopology.line('col', triangle(0, 0), () => true)]).toThrow(RangeError);
  });

  it('should_reject_at_compile_time_when_a_board_line_has_a_misspelled_axis', () => {
    const board = new Board(triangleTopology.region(RegionSize.of(2)), triangleTopology);

    // @ts-expect-error `rwo` is not an axis of the triangle topology.
    expect(() => [...board.line('rwo', triangle(0, 0))]).toThrow(RangeError);
  });
});

describe('test double unions', () => {
  it('should_declare_their_own_axes_and_directions_when_the_doubles_are_read', () => {
    const squareAxes: SquareAxis[] = squareTopology.axes();
    const squareDirections: SquareDirection[] = squareTopology.directions();
    const triangleAxes: TriangleAxis[] = triangleTopology.axes();
    const triangleDirections: TriangleDirection[] = triangleTopology.directions();

    expect(squareAxes).toEqual(['col', 'row']);
    expect(squareDirections).toEqual(['north', 'east', 'south', 'west']);
    expect(triangleAxes).toEqual(['row', 'down-right', 'down-left']);
    expect(triangleDirections).toEqual(['left', 'right', 'vertical']);
  });

  it('should_hold_a_board_with_an_axis_union_when_a_board_state_is_typed', () => {
    const board: Board<FakeCell, SquareCoord, SquareAxis> = emptyState(2).board;
    const state: BoardState<FakeCell, SquareCoord> = emptyState(2);

    expect([...board.line('col', square(0, 1))]).toEqual([square(0, 1), square(1, 1)]);
    expect(state.board.shape.cells).toHaveLength(4);
  });
});

describe('Radius', () => {
  it('should_keep_the_value_when_the_radius_is_a_whole_number_of_zero_or_more', () => {
    expect(Radius.of(0).value).toBe(0);
    expect(Radius.of(3).value).toBe(3);
  });

  it('should_throw_a_range_error_when_the_radius_is_negative_or_not_a_whole_number', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => Radius.of(value)).toThrow(RangeError);
      expect(() => Radius.of(value)).toThrow(
        `A radius needs a whole number of zero or more, not ${value}.`,
      );
    }
  });

  it('should_give_the_center_when_a_board_ring_has_radius_zero', () => {
    const board = new Board(squareTopology.region(RegionSize.of(3)), squareTopology);

    expect([...board.ring(square(1, 1), Radius.of(0))]).toEqual([square(1, 1)]);
  });
});

describe('RegionSize', () => {
  it('should_keep_the_value_when_the_size_is_a_whole_number_of_one_or_more', () => {
    expect(RegionSize.of(1).value).toBe(1);
    expect(RegionSize.of(5).value).toBe(5);
  });

  it('should_throw_a_range_error_when_the_size_is_below_one_or_not_a_whole_number', () => {
    for (const value of [0, -2, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => RegionSize.of(value)).toThrow(RangeError);
      expect(() => RegionSize.of(value)).toThrow(
        `A region size needs a whole number of one or more, not ${value}.`,
      );
    }
  });

  it('should_cover_one_cell_when_the_region_size_is_one', () => {
    expect(squareTopology.region(RegionSize.of(1)).cells).toEqual([square(0, 0)]);
  });
});

describe('Turns', () => {
  it('should_keep_the_value_when_the_count_is_any_whole_number', () => {
    expect(Turns.of(-2).value).toBe(-2);
    expect(Turns.of(0).value).toBe(0);
    expect(Turns.of(7).value).toBe(7);
  });

  it('should_throw_a_range_error_when_the_count_is_not_a_whole_number', () => {
    for (const value of [0.5, -1.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => Turns.of(value)).toThrow(RangeError);
      expect(() => Turns.of(value)).toThrow(`A turn count needs a whole number, not ${value}.`);
    }
  });

  it('should_rotate_backward_when_the_count_is_negative', () => {
    expect(squareTopology.rotate(square(1, 0), Turns.of(-1))).toEqual(square(0, -1));
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
