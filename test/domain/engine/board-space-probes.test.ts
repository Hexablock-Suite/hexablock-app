/** @jest-environment node */
import { Board, BoardSpace } from '../../../src/domain/engine/board';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { square, squareTopology } from '../../support/engine/square-topology';
import { BOARD_ID } from '../../support/engine/entity-ids';

// Probes for F0 (S5): the entity is private to Board, clone copies it, order is first-write.
const region = () => squareTopology.region(RegionSize.of(2));
const newBoard = () =>
  new Board<string, ReturnType<typeof square>, string>(BOARD_ID, region(), squareTopology);

describe('Board with BoardSpace entities (probes)', () => {
  it('should_leave_the_original_unchanged_when_the_clone_is_changed', () => {
    const board = newBoard();
    board.occupy(square(0, 0), 'red');
    const copy = board.clone();

    copy.occupy(square(0, 0), 'blue');
    copy.occupy(square(1, 0), 'green');

    expect(board.get(square(0, 0))).toBe('red');
    expect(board.get(square(1, 0))).toBeUndefined();
    expect(board.cells()).toEqual([[square(0, 0), 'red']]);
  });

  it('should_leave_the_clone_unchanged_when_the_original_is_changed_after_the_copy', () => {
    const board = newBoard();
    board.occupy(square(0, 0), 'red');
    const copy = board.clone();

    board.occupy(square(0, 0), 'blue');
    board.occupy(square(1, 0), 'green');

    expect(copy.get(square(0, 0))).toBe('red');
    expect(copy.get(square(1, 0))).toBeUndefined();
    expect(copy.cells()).toEqual([[square(0, 0), 'red']]);
  });

  it('should_keep_the_first_write_order_when_a_clone_overwrites_and_adds_cells', () => {
    const board = newBoard();
    board.occupy(square(1, 1), 'a');
    board.occupy(square(0, 0), 'b');
    const copy = board.clone();

    copy.occupy(square(1, 1), 'c');
    copy.occupy(square(1, 0), 'd');

    expect(copy.cells().map(([, cell]) => cell)).toEqual(['c', 'b', 'd']);
    expect(board.cells().map(([, cell]) => cell)).toEqual(['a', 'b']);
  });

  it('should_list_a_cell_once_with_its_latest_value_when_one_coordinate_has_two_objects', () => {
    const board = newBoard();
    board.occupy(square(1, 1), 'first');
    board.occupy(square(1, 1), 'second');

    expect(board.cells()).toEqual([[square(1, 1), 'second']]);
  });

  it('should_not_change_the_board_when_a_caller_edits_the_pairs_of_cells', () => {
    const board = newBoard();
    board.occupy(square(0, 0), 'red');

    const pairs = board.cells();
    pairs[0]![1] = 'tampered';
    pairs.length = 0;

    expect(board.cells()).toEqual([[square(0, 0), 'red']]);
  });

  it('should_keep_a_space_apart_from_another_space_when_both_hold_the_same_state', () => {
    const topology = { key: (c: { x: number }) => String(c.x) as never };
    const one = BoardSpace.free<string, { x: number }>({ x: 1 }, topology);
    const two = BoardSpace.free<string, { x: number }>({ x: 2 }, topology);
    one.occupy('red');
    two.occupy('red');

    expect(one.equals(two)).toBe(false);
    expect(one.equals(one.clone())).toBe(true);
  });
});
