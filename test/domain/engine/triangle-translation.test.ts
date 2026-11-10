/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import { Piece } from '../../../src/domain/engine/piece';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../../src/domain/engine/shape-node';
import { Turns } from '../../../src/domain/engine/turns';
import { fakeCell } from '../../support/engine/fake-cell';
import {
  TriangleAxis,
  isUp,
  triangle,
  triangleTopology,
  type TriangleCoord,
} from '../../support/engine/triangle-topology';
import { BOARD_ID } from '../../support/engine/entity-ids';

// Classes.md decision 16: a triangle points up or down by the parity of column plus row.
// An engine that adds two coordinates one component at a time flips that parity
// when the offset is odd. So this test translates by an odd offset (Trap of issue 69).

// An up triangle and the down triangle on its right: a rhombus.
function rhombus(): Piece<ReturnType<typeof fakeCell>, TriangleCoord> {
  return new Piece(
    new ShapeGroup([new CellNode(triangle(0, 0)), new CellNode(triangle(1, 0))]),
    fakeCell(1),
  );
}

// The sum of the two components of the offset is odd.
const oddOffset = triangle(1, 0);

describe('Piece translation on the triangle topology double', () => {
  it('should_move_each_cell_through_the_topology_when_the_offset_is_odd', () => {
    const moved = rhombus().translated(oddOffset, triangleTopology);

    expect(moved.cells()).toEqual([triangle(2, 0), triangle(3, 0)]);
  });

  it('should_keep_every_cell_orientation_when_the_offset_is_odd', () => {
    const before = rhombus().cells();

    const after = rhombus().translated(oddOffset, triangleTopology).cells();

    expect(after.map(isUp)).toEqual(before.map(isUp));
  });

  it('should_flip_the_orientation_when_coordinates_are_added_one_component_at_a_time', () => {
    // This is the coupling the engine must avoid. It shows that the odd offset detects it.
    // A coordinate keeps its values private and has no such sum, so the test adds the numbers:
    // the rhombus cells (0, 0) and (1, 0), plus the odd offset (1, 0).
    const naive = [triangle(0 + 1, 0 + 0), triangle(1 + 1, 0 + 0)];

    expect(naive.map(isUp)).toEqual([false, true]);
  });

  it('should_keep_the_content_and_the_original_when_a_piece_is_translated', () => {
    const piece = rhombus();

    const moved = piece.translated(oddOffset, triangleTopology);

    expect(moved.cell()).toEqual(fakeCell(1));
    expect(piece.cells()).toEqual([triangle(0, 0), triangle(1, 0)]);
  });

  it('should_count_two_cells_when_the_area_of_the_rhombus_is_read', () => {
    const shape = new ShapeGroup([new CellNode(triangle(0, 0)), new CellNode(triangle(1, 0))]);

    expect(shape.area()).toBe(2);
    expect(rhombus().cells()).toHaveLength(2);
  });

  it('should_throw_when_a_shape_group_has_no_child', () => {
    expect(() => new ShapeGroup<TriangleCoord>([])).toThrow('at least one child');
  });

  it('should_return_an_equal_piece_when_a_piece_is_cloned', () => {
    const piece = rhombus();

    const copy = piece.clone();

    expect(copy).not.toBe(piece);
    expect(copy.cells()).toEqual(piece.cells());
    expect(copy.cell()).toEqual(piece.cell());
  });

  it('should_return_to_the_start_when_a_piece_rotates_a_full_turn', () => {
    const turned = rhombus().rotated(triangleTopology.fullTurn(), triangleTopology);

    expect(turned.cells()).toEqual(rhombus().cells());
  });

  it('should_flip_the_orientation_when_a_triangle_rotates_one_step', () => {
    expect(isUp(triangleTopology.rotate(triangle(0, 0), Turns.of(1)))).toBe(false);
  });

  it('should_give_three_neighbors_of_the_other_orientation_when_neighbors_are_read', () => {
    const neighbors = triangleTopology.neighbors(triangle(0, 0));

    expect(neighbors).toEqual([triangle(-1, 0), triangle(1, 0), triangle(0, 1)]);
    expect(neighbors.every((n) => !isUp(n))).toBe(true);
  });

  it('should_keep_two_triangles_neighbors_when_both_rotate_one_step', () => {
    const a = triangleTopology.rotate(triangle(0, 0), Turns.of(1));
    const b = triangleTopology.rotate(triangle(1, 0), Turns.of(1));

    expect(triangleTopology.neighbors(a)).toContainEqual(b);
  });

  it('should_walk_the_strip_when_a_board_line_follows_the_row_axis', () => {
    const board = new Board(BOARD_ID, triangleTopology.region(RegionSize.of(2)), triangleTopology);

    expect([...board.line(TriangleAxis.row, triangle(2, 0))]).toEqual([
      triangle(0, 0),
      triangle(1, 0),
      triangle(2, 0),
      triangle(3, 0),
    ]);
  });

  it('should_zigzag_inside_the_board_when_a_board_line_follows_a_diagonal_axis', () => {
    const board = new Board(BOARD_ID, triangleTopology.region(RegionSize.of(2)), triangleTopology);

    expect([...board.line(TriangleAxis.downRight, triangle(1, 0))]).toEqual([
      triangle(1, 0),
      triangle(2, 0),
      triangle(2, 1),
      triangle(3, 1),
    ]);
  });
});

// A group of groups: the rhombus as one child group, and one more triangle.
function nested(): ShapeGroup<TriangleCoord> {
  return new ShapeGroup([
    new ShapeGroup([new CellNode(triangle(0, 0)), new CellNode(triangle(1, 0))]),
    new CellNode(triangle(2, 0)),
  ]);
}

describe('Nested shape groups and negative moves on the triangle topology double', () => {
  it('should_list_the_cells_of_every_level_when_a_group_holds_a_group', () => {
    expect(nested().cells()).toEqual([triangle(0, 0), triangle(1, 0), triangle(2, 0)]);
    expect(nested().area()).toBe(3);
  });

  it('should_move_every_level_through_the_topology_when_a_group_of_groups_is_translated', () => {
    const moved = nested().translated(oddOffset, triangleTopology);

    expect(moved.cells()).toEqual(
      nested()
        .cells()
        .map((c) => triangleTopology.translate(c, oddOffset)),
    );
    expect(moved.area()).toBe(3);
  });

  it('should_turn_every_level_through_the_topology_when_a_group_of_groups_is_rotated', () => {
    const turned = nested().rotated(Turns.of(1), triangleTopology);

    expect(turned.cells()).toEqual(
      nested()
        .cells()
        .map((c) => triangleTopology.rotate(c, Turns.of(1))),
    );
    expect(turned.area()).toBe(3);
  });

  it('should_keep_every_cell_orientation_when_the_offset_is_negative', () => {
    const negativeOffset = triangle(-1, 0);
    const before = rhombus().cells();

    const after = rhombus().translated(negativeOffset, triangleTopology).cells();

    expect(after).toEqual([triangle(-2, 0), triangle(-1, 0)]);
    expect(after.map(isUp)).toEqual(before.map(isUp));
  });

  it('should_return_to_the_start_when_a_piece_rotates_back_one_step_and_forward_one_step', () => {
    const back = rhombus().rotated(Turns.of(-1), triangleTopology);

    expect(back.cells()).not.toEqual(rhombus().cells());
    expect(back.rotated(Turns.of(1), triangleTopology).cells()).toEqual(rhombus().cells());
  });
});
