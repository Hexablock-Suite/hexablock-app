/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import type { Axis, Direction, GridTopology } from '../../../src/domain/engine/grid-topology';

// A one-dimensional topology: a coordinate is an integer on a strip.
// It exists only in this test, so the board test needs no real geometry.
const stripTopology: GridTopology<number> = {
  rotationSteps: 2,
  key: (c) => String(c),
  neighbors: (c) => [c - 1, c + 1],
  directions: (): Direction[] => ['left', 'right'],
  axes: (): Axis[] => ['x'],
  rotate: (c, steps) => (steps % 2 === 0 ? c : -c),
  translate: (c, offset) => c + offset,
  *line(_axis, through, contains) {
    let start = through;
    while (contains(start - 1)) start -= 1;
    for (let c = start; contains(c); c += 1) yield c;
  },
  ring: (center, radius) => (radius === 0 ? [center] : [center - radius, center + radius]),
  region: (size) => BoardShape.of(Array.from({ length: size }, (_, i) => i)),
};

// The board covers the cells 0 to 4.
function newBoard(): Board<string, number> {
  return new Board(stripTopology.region(5), stripTopology);
}

describe('Board', () => {
  it('should_return_undefined_when_cell_is_empty', () => {
    expect(newBoard().get(2)).toBeUndefined();
  });

  it('should_return_the_cell_when_it_was_set', () => {
    const board = newBoard();

    board.set(2, 'red');

    expect(board.get(2)).toBe('red');
  });

  it('should_replace_the_cell_when_set_twice', () => {
    const board = newBoard();

    board.set(2, 'red');
    board.set(2, 'blue');

    expect(board.get(2)).toBe('blue');
  });

  it('should_throw_when_set_is_outside_the_shape', () => {
    expect(() => newBoard().set(9, 'red')).toThrow('outside the board');
  });

  it('should_list_every_filled_cell_when_cells_is_read', () => {
    const board = newBoard();
    board.set(1, 'red');
    board.set(3, 'blue');

    expect(board.cells()).toEqual([
      [1, 'red'],
      [3, 'blue'],
    ]);
  });

  it('should_keep_the_clone_unchanged_when_the_original_changes', () => {
    const board = newBoard();
    board.set(1, 'red');

    const copy = board.clone();
    board.set(1, 'blue');
    board.set(2, 'green');

    expect(copy.get(1)).toBe('red');
    expect(copy.get(2)).toBeUndefined();
    expect(copy.shape).toBe(board.shape);
    expect(copy.topology).toBe(board.topology);
  });

  it('should_walk_the_whole_axis_inside_the_shape_when_line_is_read', () => {
    expect([...newBoard().line('x', 2)]).toEqual([0, 1, 2, 3, 4]);
  });

  it('should_drop_ring_cells_outside_the_shape_when_ring_is_read', () => {
    const board = newBoard();

    expect([...board.ring(1, 2)]).toEqual([3]);
    expect([...board.ring(2, 2)]).toEqual([0, 4]);
  });

  it('should_drop_neighbors_outside_the_shape_when_neighborhood_is_read', () => {
    const board = newBoard();

    expect([...board.neighborhood(0)]).toEqual([1]);
    expect([...board.neighborhood(2)]).toEqual([1, 3]);
  });

  it('should_report_whether_a_coordinate_is_inside_when_contains_is_asked', () => {
    const board = newBoard();

    expect(board.contains(4)).toBe(true);
    expect(board.contains(5)).toBe(false);
  });
});
