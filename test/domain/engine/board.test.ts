/** @jest-environment node */
import { Board, BoardSpace } from '../../../src/domain/engine/board';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import { coordKey, type CoordKey } from '../../../src/domain/engine/coord-key';
import type { GridTopology } from '../../../src/domain/engine/grid-topology';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Turns } from '../../../src/domain/engine/turns';
import { ColorStack } from '../../../src/domain/variants/hexa-sort/color-stack';

// A one-dimensional topology: a coordinate is an integer on a strip.
// It exists only in this test, so the board test needs no real geometry.
const stripTopology: GridTopology<number, 'x', 'left' | 'right'> = {
  fullTurn: () => Turns.of(2),
  key: (c) => coordKey(String(c)),
  neighbors: (c) => [c - 1, c + 1],
  neighbor: (c, direction) => (direction === 'left' ? c - 1 : c + 1),
  directions: () => ['left', 'right'],
  axes: () => ['x'],
  rotate: (c, turns) => turns.applyTo(c, (at) => -at, stripTopology),
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

  it('should_keep_the_first_write_order_when_cells_is_read', () => {
    const board = newBoard();
    board.set(3, 'red');
    board.set(1, 'blue');
    board.set(3, 'green');
    const initial = new Board<string, number, 'x'>(
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
      new Map<CoordKey, [number, string]>([
        [coordKey('4'), [4, 'red']],
        [coordKey('0'), [0, 'blue']],
      ]),
    );

    const written = [
      [3, 'green'],
      [1, 'blue'],
    ];
    expect(board.cells()).toEqual(written);
    expect(board.clone().cells()).toEqual(written);
    expect(initial.cells()).toEqual([
      [4, 'red'],
      [0, 'blue'],
    ]);
  });

  // Sort marks a free cell with an empty stack. Every other variant leaves the coordinate unset.
  it('should_keep_both_forms_of_a_free_cell_when_the_board_is_read', () => {
    const board = new Board<ColorStack, number, 'x'>(
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );
    const empty = ColorStack.empty();

    board.set(1, empty);

    expect(board.get(1)).toBe(empty);
    expect(board.get(2)).toBeUndefined();
    expect(board.cells()).toEqual([[1, empty]]);
  });

  it('should_list_an_undefined_cell_when_it_was_set', () => {
    const board = new Board<string | undefined, number, 'x'>(
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );

    board.set(1, undefined);

    expect(board.get(1)).toBeUndefined();
    expect(board.cells()).toEqual([[1, undefined]]);
    expect(board.clone().cells()).toEqual([[1, undefined]]);
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

  it('should_yield_nothing_when_a_line_starts_outside_the_board', () => {
    const board = newBoard();

    expect([...board.line('x', 5)]).toEqual([]);
    expect([...board.line('x', -1)]).toEqual([]);
  });

  // The walks are one-shot iterables: a second loop over the same iterable gives nothing.
  it('should_yield_nothing_the_second_time_when_a_line_is_iterated_twice', () => {
    const line = newBoard().line('x', 2);

    expect([...line]).toEqual([0, 1, 2, 3, 4]);
    expect([...line]).toEqual([]);
  });

  it('should_yield_nothing_the_second_time_when_a_ring_is_iterated_twice', () => {
    const ring = newBoard().ring(2, Radius.of(2));

    expect([...ring]).toEqual([0, 4]);
    expect([...ring]).toEqual([]);
  });

  it('should_yield_nothing_the_second_time_when_a_neighborhood_is_iterated_twice', () => {
    const neighborhood = newBoard().neighborhood(2);

    expect([...neighborhood]).toEqual([1, 3]);
    expect([...neighborhood]).toEqual([]);
  });

  it('should_report_whether_a_coordinate_is_inside_when_contains_is_asked', () => {
    const board = newBoard();

    expect(board.contains(4)).toBe(true);
    expect(board.contains(5)).toBe(false);
  });
});

describe('Board shape invariants', () => {
  // A value object never lets a mutable object out: the shape freezes its copy of the list.
  // A frozen list throws on `push()`. A write by index throws only in strict mode,
  // so the test accepts a throw and then reads the cells.
  it('should_keep_its_cells_when_a_caller_changes_the_list_of_a_shape', () => {
    const source = [0, 1];
    const shape = BoardShape.of(source);
    const cells = shape.cells as number[];

    expect(() => cells.push(2)).toThrow(TypeError);
    try {
      cells[0] = 9;
    } catch {
      // The frozen list rejected the write.
    }
    source.push(3);

    expect(Object.isFrozen(shape.cells)).toBe(true);
    expect(shape.cells).toEqual([0, 1]);
  });

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

describe('Board initial content', () => {
  function contentOf(...entries: [CoordKey, [number, string]][]): Map<CoordKey, [number, string]> {
    return new Map(entries);
  }

  it('should_throw_a_range_error_when_the_initial_content_lies_outside_the_shape', () => {
    const shape = stripTopology.region(RegionSize.of(5));
    const content = contentOf([coordKey('7'), [7, 'red']]);

    expect(() => new Board(shape, stripTopology, content)).toThrow(RangeError);
    expect(() => new Board(shape, stripTopology, content)).toThrow(
      'The coordinate 7 is outside the board.',
    );
  });

  it('should_throw_a_range_error_when_an_initial_key_does_not_match_its_coordinate', () => {
    const shape = stripTopology.region(RegionSize.of(5));
    const content = contentOf([coordKey('3'), [1, 'red']]);

    expect(() => new Board(shape, stripTopology, content)).toThrow(RangeError);
    expect(() => new Board(shape, stripTopology, content)).toThrow(
      'The key 3 does not match the key 1 of its coordinate.',
    );
  });

  it('should_keep_the_board_unchanged_when_the_caller_changes_an_initial_tuple', () => {
    const tuple: [number, string] = [1, 'red'];
    const board = new Board(
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
      contentOf([coordKey('1'), tuple]),
    );
    const copy = board.clone();

    tuple[1] = 'blue';
    const [first] = board.cells();
    if (first !== undefined) first[1] = 'green';

    expect(board.get(1)).toBe('red');
    expect(copy.get(1)).toBe('red');
  });

  it('should_keep_the_initial_cells_when_the_content_matches_the_shape', () => {
    const board = new Board(
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
      contentOf([coordKey('0'), [0, 'red']], [coordKey('4'), [4, 'blue']]),
    );

    expect(board.cells()).toEqual([
      [0, 'red'],
      [4, 'blue'],
    ]);
  });
});

describe('BoardSpace', () => {
  // A coordinate is an object here, so one coordinate can have two objects.
  type Point = { readonly x: number };
  const pointTopology = { key: (c: Point) => coordKey(String(c.x)) };

  function freeSpace(x: number): BoardSpace<string, Point> {
    return BoardSpace.free<string, Point>({ x }, pointTopology);
  }

  it('should_be_the_same_space_when_two_objects_have_the_same_coordinate', () => {
    const space = freeSpace(1);

    expect(space.equals(freeSpace(1))).toBe(true);
    expect(space.equals(freeSpace(2))).toBe(false);
  });

  it('should_ignore_the_state_when_two_spaces_are_compared', () => {
    const red = freeSpace(1);
    red.occupy('red');
    const blue = freeSpace(1);
    blue.occupy('blue');
    const redElsewhere = freeSpace(2);
    redElsewhere.occupy('red');

    expect(red.equals(blue)).toBe(true);
    expect(red.equals(freeSpace(1))).toBe(true);
    expect(red.equals(redElsewhere)).toBe(false);
  });

  it('should_go_from_free_to_occupied_when_a_cell_occupies_the_space', () => {
    const space = freeSpace(1);

    expect(space.occupation()).toBeUndefined();

    space.occupy('red');
    expect(space.occupation()).toEqual([{ x: 1 }, 'red']);

    space.occupy('blue');
    expect(space.occupation()).toEqual([{ x: 1 }, 'blue']);
  });

  // `Board` hands out no space. The spy runs the real method.
  // It shows the space of each board: the one that `clone()` reads and the one it returns.
  it('should_hold_a_distinct_space_on_each_side_when_the_board_is_cloned', () => {
    const cloneSpace = jest.spyOn(BoardSpace.prototype, 'clone');
    const board = newBoard();
    board.set(1, 'red');

    const copy = board.clone();

    const { contexts, results } = cloneSpace.mock;
    cloneSpace.mockRestore();
    const original: BoardSpace<string, number> = contexts[0];
    const cloned: BoardSpace<string, number> = results[0]?.value;
    expect(contexts).toHaveLength(1);
    expect(cloned).not.toBe(original);
    expect(cloned.equals(original)).toBe(true);

    original.occupy('blue');
    expect(board.get(1)).toBe('blue');
    expect(copy.get(1)).toBe('red');

    cloned.occupy('green');
    expect(copy.get(1)).toBe('green');
    expect(board.get(1)).toBe('blue');
  });
});
