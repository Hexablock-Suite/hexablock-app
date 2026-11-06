/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Turns } from '../../../src/domain/engine/turns';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import {
  square,
  squareTopology,
  type SquareAxis,
  type SquareCoord,
} from '../../support/engine/square-topology';

// APP-NFR-13 (D4): the board runs with a cell type and a topology that exist only in test/.
function newBoard(): Board<FakeCell, SquareCoord, SquareAxis> {
  return new Board(squareTopology.region(RegionSize.of(3)), squareTopology);
}

describe('Board with the square topology double', () => {
  it('should_cover_nine_cells_when_the_region_size_is_three', () => {
    const board = newBoard();

    expect(board.shape.cells).toHaveLength(9);
    expect(board.contains(square(2, 2))).toBe(true);
    expect(board.contains(square(3, 0))).toBe(false);
  });

  it('should_read_the_fake_cell_back_when_it_was_set', () => {
    const board = newBoard();

    board.set(square(1, 2), fakeCell(7));

    expect(board.get(square(1, 2))).toEqual(fakeCell(7));
    expect(board.get(square(2, 1))).toBeUndefined();
  });

  it('should_walk_the_row_when_line_follows_the_col_axis', () => {
    expect([...newBoard().line('col', square(1, 1))]).toEqual([
      square(0, 1),
      square(1, 1),
      square(2, 1),
    ]);
  });

  it('should_walk_the_column_when_line_follows_the_row_axis', () => {
    expect([...newBoard().line('row', square(2, 0))]).toEqual([
      square(2, 0),
      square(2, 1),
      square(2, 2),
    ]);
  });

  it('should_give_four_neighbors_when_the_cell_is_the_center', () => {
    expect([...newBoard().neighborhood(square(1, 1))]).toHaveLength(4);
  });

  it('should_give_two_neighbors_when_the_cell_is_a_corner', () => {
    expect([...newBoard().neighborhood(square(0, 0))]).toEqual([square(1, 0), square(0, 1)]);
  });

  it('should_give_the_four_corners_when_the_ring_has_radius_two_around_the_center', () => {
    const ring = [...newBoard().ring(square(1, 1), Radius.of(2))];

    expect(ring).toHaveLength(4);
    expect(ring).toEqual(
      expect.arrayContaining([square(0, 0), square(2, 0), square(0, 2), square(2, 2)]),
    );
  });

  it('should_keep_the_clone_unchanged_when_the_original_changes', () => {
    const board = newBoard();
    board.set(square(0, 0), fakeCell(1));

    const copy = board.clone();
    board.set(square(0, 0), fakeCell(2));

    expect(copy.get(square(0, 0))).toEqual(fakeCell(1));
  });

  it('should_rotate_a_quarter_turn_when_rotate_takes_one_step', () => {
    expect(squareTopology.rotate(square(1, 0), Turns.of(1))).toEqual(square(0, 1));
    expect(squareTopology.rotate(square(1, 0), Turns.of(squareTopology.rotationSteps))).toEqual(
      square(1, 0),
    );
  });

  // A negative count turns the other way: one turn back equals three turns forward.
  it('should_turn_backward_when_the_turn_count_is_negative', () => {
    expect(squareTopology.rotate(square(1, 0), Turns.of(-1))).toEqual(square(0, -1));
    expect(squareTopology.rotate(square(1, 0), Turns.of(-3))).toEqual(square(0, 1));
  });
});
