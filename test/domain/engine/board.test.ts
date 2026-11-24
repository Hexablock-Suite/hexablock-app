/** @jest-environment node */
import { Board, BoardSpace } from '../../../src/domain/engine/board';
import { BoardId } from '../../../src/domain/engine/board-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import { CoordKey } from '../../../src/domain/engine/coord-key';
import { Distance } from '../../../src/domain/engine/distance';
import type { GridTopology } from '../../../src/domain/engine/grid-topology';
import { Radius } from '../../../src/domain/engine/radius';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Turns } from '../../../src/domain/engine/turns';
import { ColorStack } from '../../../src/domain/variants/hexa-sort/color-stack';
import { BOARD_ID } from '../../support/engine/entity-ids';

// A one-dimensional topology: a coordinate is an integer on a strip.
// It exists only in this test, so the board test needs no real geometry.
// The strip has one axis and two directions. Each one has `equals()`, as the engine asks.
function named(name: string): { readonly name: string; equals(other: unknown): boolean } {
  const value = { name, equals: (other: unknown) => other === value };
  return value;
}
const X = named('x');
const LEFT = named('left');
const RIGHT = named('right');

// One step along the strip: forward adds 1, and backward takes 1 away.
const strip = { forward: (c: number) => c + 1, backward: (c: number) => c - 1 };

const stripTopology: GridTopology<number> = {
  fullTurn: () => Turns.of(2),
  key: (c) => CoordKey.of(String(c)),
  neighbors: (c) => [c - 1, c + 1],
  neighbor: (c, direction) => (direction.equals(LEFT) ? c - 1 : c + 1),
  directions: () => [LEFT, RIGHT],
  axes: () => [X],
  rotate: (c, turns) => turns.applyTo(c, (at) => -at, stripTopology),
  translate: (c, offset) => c + offset,
  translationOffset: (from, to) => to - from,
  *line(_axis, through, contains) {
    let start = through;
    while (contains(start - 1)) start -= 1;
    for (let c = start; contains(c); c += 1) yield c;
  },
  // The cells at the distance of the radius: one for radius 0, and two for any other radius.
  ring: (center, radius) =>
    [...radius.offsets(center, strip)].filter((c) =>
      radius.measures(Distance.of(Math.abs(c - center))),
    ),
  region: (size) => BoardShape.of([...size.indexes(0, strip)]),
};

// The board covers the cells 0 to 4.
function newBoard(): Board<string, number> {
  return new Board(BOARD_ID, stripTopology.region(RegionSize.of(5)), stripTopology);
}

describe('Board', () => {
  it('should_align_a_piece_anchor_with_each_free_cell_when_the_board_is_irregular', () => {
    const board = new Board<string, number>(BOARD_ID, BoardShape.of([0, 2, 5]), stripTopology);
    board.occupy(2, 'blue');

    expect([...board.candidatePlacementOffsets(3)]).toEqual([-3, 2]);
    expect(board.occupiedCells()).toEqual([[2, 'blue']]);
  });

  it('should_return_undefined_when_cell_is_empty', () => {
    expect(newBoard().occupantAt(2)).toBeUndefined();
  });

  it('should_return_the_cell_when_it_occupies_the_coordinate', () => {
    const board = newBoard();

    board.occupy(2, 'red');

    expect(board.occupantAt(2)).toBe('red');
  });

  it('should_replace_the_cell_when_two_cells_occupy_one_coordinate', () => {
    const board = newBoard();

    board.occupy(2, 'red');
    board.occupy(2, 'blue');

    expect(board.occupantAt(2)).toBe('blue');
  });

  // Issue #246: a key is a value object, and each call of `key()` gives a new object.
  // So the board finds a space by an equal key, not by the same object.
  it('should_find_the_space_when_the_key_of_the_coordinate_is_equal_but_not_the_same_object', () => {
    const board = newBoard();

    board.occupy(2, 'red');

    expect(stripTopology.key(2)).not.toBe(stripTopology.key(2));
    expect(board.contains(2)).toBe(true);
    expect(board.occupantAt(2)).toBe('red');
    expect(board.freeSpaces()).toEqual([0, 1, 3, 4]);
    board.vacate(2);
    expect(board.occupantAt(2)).toBeUndefined();
    expect(board.isFull()).toBe(false);
  });

  it('should_throw_when_occupy_is_outside_the_shape', () => {
    expect(() => newBoard().occupy(9, 'red')).toThrow('outside the board');
  });

  it('should_list_every_filled_cell_when_cells_is_read', () => {
    const board = newBoard();
    board.occupy(1, 'red');
    board.occupy(3, 'blue');

    expect(board.occupiedCells()).toEqual([
      [1, 'red'],
      [3, 'blue'],
    ]);
  });

  it('should_keep_the_first_write_order_when_cells_is_read', () => {
    const board = newBoard();
    board.occupy(3, 'red');
    board.occupy(1, 'blue');
    board.occupy(3, 'green');
    const initial = new Board<string, number>(
      BOARD_ID,
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
      new Map<CoordKey, [number, string]>([
        [CoordKey.of('4'), [4, 'red']],
        [CoordKey.of('0'), [0, 'blue']],
      ]),
    );

    const written = [
      [3, 'green'],
      [1, 'blue'],
    ];
    expect(board.occupiedCells()).toEqual(written);
    expect(board.clone().occupiedCells()).toEqual(written);
    expect(initial.occupiedCells()).toEqual([
      [4, 'red'],
      [0, 'blue'],
    ]);
  });

  // Sort marks a free cell with an empty stack. Every other variant leaves the coordinate unset.
  it('should_keep_both_forms_of_a_free_cell_when_the_board_is_read', () => {
    const board = new Board<ColorStack, number>(
      BOARD_ID,
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );
    const empty = ColorStack.empty();

    board.occupy(1, empty);

    expect(board.occupantAt(1)).toBe(empty);
    expect(board.occupantAt(2)).toBeUndefined();
    expect(board.occupiedCells()).toEqual([[1, empty]]);
  });

  it('should_list_an_undefined_cell_when_it_occupies_a_coordinate', () => {
    const board = new Board<string | undefined, number>(
      BOARD_ID,
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );

    board.occupy(1, undefined);

    expect(board.occupantAt(1)).toBeUndefined();
    expect(board.occupiedCells()).toEqual([[1, undefined]]);
    expect(board.clone().occupiedCells()).toEqual([[1, undefined]]);
  });

  it('should_keep_the_clone_unchanged_when_the_original_changes', () => {
    const board = newBoard();
    board.occupy(1, 'red');

    const copy = board.clone();
    board.occupy(1, 'blue');
    board.occupy(2, 'green');

    expect(copy.occupantAt(1)).toBe('red');
    expect(copy.occupantAt(2)).toBeUndefined();
    expect(copy.coordinates()).toEqual(board.coordinates());
    expect(copy.axes()).toEqual(board.axes());
  });

  it('should_walk_the_whole_axis_inside_the_shape_when_line_is_read', () => {
    expect([...newBoard().line(X, 2)]).toEqual([0, 1, 2, 3, 4]);
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
    const board = new Board<{ color: string }, number>(
      BOARD_ID,
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );
    const cell = { color: 'red' };
    board.occupy(1, cell);

    const copy = board.clone();

    expect(copy.occupantAt(1)).toBe(cell);
    expect(copy.occupiedCells()[0]?.[1]).toBe(cell);
  });

  it('should_yield_nothing_when_a_line_starts_outside_the_board', () => {
    const board = newBoard();

    expect([...board.line(X, 5)]).toEqual([]);
    expect([...board.line(X, -1)]).toEqual([]);
  });

  // The walks are one-shot iterables: a second loop over the same iterable gives nothing.
  it('should_yield_nothing_the_second_time_when_a_line_is_iterated_twice', () => {
    const line = newBoard().line(X, 2);

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

// R7: the board changes only through `occupy` and `vacate`, two business intentions.
// The board is an entity inside the state (classes.md decision 7). Its `BoardId` is its identity.
describe('Board identity', () => {
  it('should_be_the_same_board_when_two_boards_have_one_id_whatever_they_hold', () => {
    const board = newBoard();
    const copy = board.clone();
    const sameId = new Board<string, number>(BOARD_ID, BoardShape.of([7]), stripTopology);

    board.occupy(1, 'red');
    copy.occupy(2, 'blue');
    copy.vacate(2);

    expect([board.equals(copy), copy.equals(board), board.equals(board)]).toEqual([
      true,
      true,
      true,
    ]);
    expect([board.equals(sameId), sameId.equals(board)]).toEqual([true, true]);
  });

  it('should_be_another_board_when_two_boards_have_different_ids_and_the_same_cells', () => {
    const board = newBoard();
    const other = new Board<string, number>(
      BoardId.of(MatchId.of('match-b')),
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
    );
    board.occupy(1, 'red');
    other.occupy(1, 'red');

    expect(board.occupiedCells()).toEqual(other.occupiedCells());
    expect([board.equals(other), other.equals(board)]).toEqual([false, false]);
    expect([board.clone().equals(other), other.clone().equals(board)]).toEqual([false, false]);
  });
});

describe('Board occupy and vacate', () => {
  it('should_hold_the_cell_when_a_cell_occupies_a_coordinate', () => {
    const board = newBoard();

    board.occupy(2, 'red');
    board.occupy(2, 'blue');

    expect(board.occupantAt(2)).toBe('blue');
    expect(board.occupiedCells()).toEqual([[2, 'blue']]);
  });

  it('should_throw_a_range_error_and_keep_the_board_when_occupy_is_outside_the_shape', () => {
    const board = newBoard();
    board.occupy(1, 'red');

    expect(() => board.occupy(9, 'blue')).toThrow(
      new RangeError('The coordinate is outside the board.', { cause: CoordKey.of('9') }),
    );
    expect(board.occupiedCells()).toEqual([[1, 'red']]);
  });

  it('should_free_the_coordinate_when_it_is_vacated', () => {
    const board = newBoard();
    board.occupy(1, 'red');
    board.occupy(3, 'blue');

    board.vacate(1);

    expect(board.occupantAt(1)).toBeUndefined();
    expect(board.occupiedCells()).toEqual([[3, 'blue']]);
  });

  it('should_throw_a_range_error_and_keep_the_board_when_vacate_is_outside_the_shape', () => {
    const board = newBoard();
    board.occupy(1, 'red');

    expect(() => board.vacate(9)).toThrow(
      new RangeError('The coordinate is outside the board.', { cause: CoordKey.of('9') }),
    );
    expect(board.occupiedCells()).toEqual([[1, 'red']]);
  });

  it('should_throw_a_range_error_and_keep_the_board_when_vacate_finds_a_free_coordinate', () => {
    const board = newBoard();
    board.occupy(1, 'red');
    board.occupy(3, 'blue');
    board.vacate(3);

    expect(() => board.vacate(2)).toThrow(
      new RangeError('The coordinate is already free.', { cause: CoordKey.of('2') }),
    );
    expect(() => board.vacate(3)).toThrow(
      new RangeError('The coordinate is already free.', { cause: CoordKey.of('3') }),
    );
    expect(board.occupiedCells()).toEqual([[1, 'red']]);
  });

  // A vacated coordinate counts as a new write when a cell occupies it again.
  // So `cells()` gives the same order as a board built again from the cells that stay.
  it('should_list_a_vacated_coordinate_last_when_a_cell_occupies_it_again', () => {
    const board = newBoard();
    board.occupy(1, 'red');
    board.occupy(3, 'blue');
    board.occupy(4, 'green');

    board.vacate(1);
    board.occupy(1, 'white');

    expect(board.occupiedCells()).toEqual([
      [3, 'blue'],
      [4, 'green'],
      [1, 'white'],
    ]);
    expect(board.clone().occupiedCells()).toEqual(board.occupiedCells());
  });

  it('should_keep_the_clone_unchanged_when_the_original_vacates', () => {
    const board = newBoard();
    board.occupy(1, 'red');
    const copy = board.clone();

    board.vacate(1);

    expect(copy.occupantAt(1)).toBe('red');
    expect(copy.occupiedCells()).toEqual([[1, 'red']]);
    expect(board.occupantAt(1)).toBeUndefined();
  });

  it('should_keep_the_original_unchanged_when_the_clone_vacates', () => {
    const board = newBoard();
    board.occupy(1, 'red');
    const copy = board.clone();

    copy.vacate(1);

    expect(board.occupantAt(1)).toBe('red');
    expect(copy.occupantAt(1)).toBeUndefined();
  });
});

// Issue #170: a game screen draws every space of the board, so the player sees the board
// and can choose a space. `freeSpaces()` names the free spaces, and `occupiedCells()`
// names the occupied ones. Together they name each coordinate of the shape once.
describe('Board free spaces', () => {
  it('should_list_every_coordinate_in_the_order_of_the_shape_when_no_cell_occupies_the_board', () => {
    expect(newBoard().freeSpaces()).toEqual([0, 1, 2, 3, 4]);
  });

  it('should_list_only_the_free_coordinates_in_the_order_of_the_shape_when_cells_occupy_some', () => {
    const board = newBoard();
    board.occupy(3, 'blue');
    board.occupy(1, 'red');
    board.occupy(4, 'green');
    board.vacate(4);

    expect(board.freeSpaces()).toEqual([0, 2, 4]);
    expect([...board.freeSpaces(), ...board.occupiedCells().map(([c]) => c)].sort()).toEqual(
      board.coordinates().sort(),
    );
  });

  // A space that a cell occupies is not free, whatever the cell is.
  it('should_list_no_occupied_coordinate_when_an_undefined_cell_or_an_empty_stack_occupies_it', () => {
    const undefinedCells = new Board<string | undefined, number>(
      BOARD_ID,
      stripTopology.region(RegionSize.of(3)),
      stripTopology,
    );
    const stacks = new Board<ColorStack, number>(
      BOARD_ID,
      stripTopology.region(RegionSize.of(3)),
      stripTopology,
    );

    undefinedCells.occupy(1, undefined);
    stacks.occupy(2, ColorStack.empty());

    expect(undefinedCells.freeSpaces()).toEqual([0, 2]);
    expect(stacks.freeSpaces()).toEqual([0, 1]);
  });

  it('should_keep_the_board_and_its_clone_unchanged_when_a_caller_changes_the_list', () => {
    const board = newBoard();
    board.occupy(2, 'red');
    const copy = board.clone();

    board.freeSpaces().splice(0, 2);
    board.occupy(0, 'blue');

    expect(board.freeSpaces()).toEqual([1, 3, 4]);
    expect(copy.freeSpaces()).toEqual([0, 1, 3, 4]);
  });
});

describe('Board shape invariants', () => {
  // A value object never lets a mutable object out: the shape keeps its own copy of the list,
  // and `coordinates()` gives a new list on each call (classes.md decision 49).
  it('should_keep_its_cells_when_a_caller_changes_the_list_of_a_shape', () => {
    const source = [0, 1];
    const shape = BoardShape.of(source);
    const cells = shape.coordinates();

    cells.push(2);
    cells[0] = 9;
    source.push(3);

    expect(shape.coordinates()).toEqual([0, 1]);
  });

  it('should_throw_a_range_error_when_the_shape_is_empty', () => {
    expect(() => BoardShape.of<number>([])).toThrow(RangeError);
    expect(() => BoardShape.of<number>([])).toThrow('at least one coordinate');
  });

  // The board owns the topology, so the board finds two equal coordinates by their key.
  it('should_throw_a_range_error_when_the_shape_repeats_a_coordinate', () => {
    const shape = BoardShape.of([0, 1, 1]);

    expect(() => new Board(BOARD_ID, shape, stripTopology)).toThrow(RangeError);
    expect(() => new Board(BOARD_ID, shape, stripTopology)).toThrow('the same key');
  });

  it('should_throw_a_range_error_when_the_topology_gives_two_coordinates_the_same_key', () => {
    const collidingTopology: GridTopology<number> = {
      ...stripTopology,
      key: (c) => CoordKey.of(String(c % 2)),
    };

    expect(
      () => new Board(BOARD_ID, stripTopology.region(RegionSize.of(3)), collidingTopology),
    ).toThrow(RangeError);
    expect(
      () => new Board(BOARD_ID, stripTopology.region(RegionSize.of(3)), collidingTopology),
    ).toThrow('the same key');
  });

  it('should_keep_every_coordinate_when_the_shape_has_no_repeated_key', () => {
    const board = new Board(BOARD_ID, BoardShape.of([4, 2, 0]), stripTopology);

    expect(board.coordinates()).toEqual([4, 2, 0]);
    expect([0, 2, 4].every((c) => board.contains(c))).toBe(true);
  });
});

describe('Board initial content', () => {
  function contentOf(...entries: [CoordKey, [number, string]][]): Map<CoordKey, [number, string]> {
    return new Map(entries);
  }

  it('should_throw_a_range_error_when_the_initial_content_lies_outside_the_shape', () => {
    const shape = stripTopology.region(RegionSize.of(5));
    const content = contentOf([CoordKey.of('7'), [7, 'red']]);

    expect(() => new Board(BOARD_ID, shape, stripTopology, content)).toThrow(RangeError);
    expect(() => new Board(BOARD_ID, shape, stripTopology, content)).toThrow(
      new RangeError('The coordinate is outside the board.', { cause: CoordKey.of('7') }),
    );
  });

  it('should_throw_a_range_error_when_an_initial_key_does_not_match_its_coordinate', () => {
    const shape = stripTopology.region(RegionSize.of(5));
    const content = contentOf([CoordKey.of('3'), [1, 'red']]);

    expect(() => new Board(BOARD_ID, shape, stripTopology, content)).toThrow(RangeError);
    expect(() => new Board(BOARD_ID, shape, stripTopology, content)).toThrow(
      new RangeError('The key does not match the key of its coordinate.', {
        cause: { key: CoordKey.of('3'), expected: CoordKey.of('1') },
      }),
    );
  });

  it('should_keep_the_board_unchanged_when_the_caller_changes_an_initial_tuple', () => {
    const tuple: [number, string] = [1, 'red'];
    const board = new Board(
      BOARD_ID,
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
      contentOf([CoordKey.of('1'), tuple]),
    );
    const copy = board.clone();

    tuple[1] = 'blue';
    const [first] = board.occupiedCells();
    if (first !== undefined) first[1] = 'green';

    expect(board.occupantAt(1)).toBe('red');
    expect(copy.occupantAt(1)).toBe('red');
  });

  it('should_keep_the_initial_cells_when_the_content_matches_the_shape', () => {
    const board = new Board(
      BOARD_ID,
      stripTopology.region(RegionSize.of(5)),
      stripTopology,
      contentOf([CoordKey.of('0'), [0, 'red']], [CoordKey.of('4'), [4, 'blue']]),
    );

    expect(board.occupiedCells()).toEqual([
      [0, 'red'],
      [4, 'blue'],
    ]);
  });
});

describe('BoardSpace', () => {
  // A coordinate is an object here, so one coordinate can have two objects.
  type Point = { readonly x: number };
  const pointTopology = { key: (c: Point) => CoordKey.of(String(c.x)) };

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

    expect(space.occupiedCell()).toBeUndefined();

    space.occupy('red');
    expect(space.occupiedCell()).toEqual([{ x: 1 }, 'red']);

    space.occupy('blue');
    expect(space.occupiedCell()).toEqual([{ x: 1 }, 'blue']);
  });

  it('should_go_back_to_free_when_an_occupied_space_is_vacated', () => {
    const space = freeSpace(1);
    space.occupy('red');

    space.vacate();

    expect(space.occupiedCell()).toBeUndefined();
    expect(space.equals(freeSpace(1))).toBe(true);
  });

  it('should_throw_a_range_error_when_a_free_space_is_vacated', () => {
    const space = freeSpace(1);

    expect(() => space.vacate()).toThrow(
      new RangeError('The space is already free.', { cause: CoordKey.of('1') }),
    );
    expect(space.occupiedCell()).toBeUndefined();
  });

  // `Board` hands out no space. The spy runs the real method.
  // It shows the space of each board: the one that `clone()` reads and the one it returns.
  it('should_hold_a_distinct_space_on_each_side_when_the_board_is_cloned', () => {
    const cloneSpace = jest.spyOn(BoardSpace.prototype, 'clone');
    const board = newBoard();
    board.occupy(1, 'red');

    const copy = board.clone();

    const { contexts, results } = cloneSpace.mock;
    cloneSpace.mockRestore();
    const original: BoardSpace<string, number> = contexts[0];
    const cloned: BoardSpace<string, number> = results[0]?.value;
    expect(contexts).toHaveLength(1);
    expect(cloned).not.toBe(original);
    expect(cloned.equals(original)).toBe(true);

    original.occupy('blue');
    expect(board.occupantAt(1)).toBe('blue');
    expect(copy.occupantAt(1)).toBe('red');

    cloned.occupy('green');
    expect(copy.occupantAt(1)).toBe('green');
    expect(board.occupantAt(1)).toBe('blue');
  });
});
