/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import { coordKey } from '../../../src/domain/engine/coord-key';
import type { GridTopology } from '../../../src/domain/engine/grid-topology';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';

// A one-dimensional topology: a coordinate is an integer on a strip.
// It exists only in this test, so the board test needs no real geometry.
const stripTopology: GridTopology<number, 'x', 'left' | 'right'> = {
  rotationSteps: 2,
  key: (c) => coordKey(String(c)),
  neighbors: (c) => [c - 1, c + 1],
  directions: () => ['left', 'right'],
  axes: () => ['x'],
  rotate: (c, turns) => (turns.value % 2 === 0 ? c : -c),
  translate: (c, offset) => c + offset,
  *line(_axis, through, contains) {
    let start = through;
    while (contains(start - 1)) start -= 1;
    for (let c = start; contains(c); c += 1) yield c;
  },
  ring: (center, { value: radius }) =>
    radius === 0 ? [center] : [center - radius, center + radius],
  region: ({ value: size }) => BoardShape.of(Array.from({ length: size }, (_, i) => i)),
};

// The board covers the cells 0 to 4.
function newBoard(): Board<string, number, 'x'> {
  return new Board(stripTopology.region(RegionSize.of(5)), stripTopology);
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

    expect([...board.ring(1, Radius.of(2))]).toEqual([3]);
    expect([...board.ring(2, Radius.of(2))]).toEqual([0, 4]);
  });

  it('should_drop_neighbors_outside_the_shape_when_neighborhood_is_read', () => {
    const board = newBoard();

    expect([...board.neighborhood(0)]).toEqual([1]);
    expect([...board.neighborhood(2)]).toEqual([1, 3]);
  });

  // A cell is a value: the clone holds the same cell objects, and never copies them.
  it('should_share_the_cell_objects_when_the_board_is_cloned', () => {
    const board = new Board<{ color: string }, number, 'x'>(
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );
    const cell = { color: 'red' };
    board.set(1, cell);

    const copy = board.clone();

    expect(copy.get(1)).toBe(cell);
    expect(copy.cells()[0]?.[1]).toBe(cell);
  });

  it('should_report_whether_a_coordinate_is_inside_when_contains_is_asked', () => {
    const board = newBoard();

    expect(board.contains(4)).toBe(true);
    expect(board.contains(5)).toBe(false);
  });
});

describe('Board shape invariants', () => {
  it('should_throw_a_range_error_when_the_shape_is_empty', () => {
    expect(() => BoardShape.of<number>([])).toThrow(RangeError);
    expect(() => BoardShape.of<number>([])).toThrow('at least one coordinate');
  });

  // The board owns the topology, so the board finds two equal coordinates by their key.
  it('should_throw_a_range_error_when_the_shape_repeats_a_coordinate', () => {
    const shape = BoardShape.of([0, 1, 1]);

    expect(() => new Board(shape, stripTopology)).toThrow(RangeError);
    expect(() => new Board(shape, stripTopology)).toThrow('the same key');
  });

  it('should_throw_a_range_error_when_the_topology_gives_two_coordinates_the_same_key', () => {
    const collidingTopology: GridTopology<number, 'x', 'left' | 'right'> = {
      ...stripTopology,
      key: (c) => coordKey(String(c % 2)),
    };

    expect(() => new Board(stripTopology.region(RegionSize.of(3)), collidingTopology)).toThrow(
      RangeError,
    );
    expect(() => new Board(stripTopology.region(RegionSize.of(3)), collidingTopology)).toThrow(
      'the same key',
    );
  });

  it('should_keep_every_coordinate_when_the_shape_has_no_repeated_key', () => {
    const board = new Board(BoardShape.of([4, 2, 0]), stripTopology);

    expect(board.shape.cells).toEqual([4, 2, 0]);
    expect([0, 2, 4].every((c) => board.contains(c))).toBe(true);
  });
});
