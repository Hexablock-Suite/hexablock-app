/** @jest-environment node */
import { Board, type ReadonlyBoard } from '../../../src/domain/engine/board';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import { Color } from '../../../src/domain/engine/color';
import { HexAxis, HexTopology, hex } from '../../../src/domain/engine/hex-topology';
import { Piece } from '../../../src/domain/engine/piece';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../../src/domain/engine/shape-node';
import { Turns } from '../../../src/domain/engine/turns';
import { PieceId } from '../../../src/domain/variants/hexa-fit/piece-id';
import { BOARD_ID } from '../../support/engine/entity-ids';
import {
  square,
  squareTopology,
  SquareAxis,
  type SquareCoord,
} from '../../support/engine/square-topology';
import { triangleTopology, TriangleAxis } from '../../support/engine/triangle-topology';

// Issue #211 (classes.md decision 49): the board, the board shape, the piece and the piece id
// keep their fields private. A reader asks an operation with a business name.

const RED = Color.of('red');
const hexTopology = new HexTopology();

// A square board of 3 by 3 cells. The cells hold a color.
function squareBoard(): Board<Color, SquareCoord, SquareAxis> {
  return new Board(BOARD_ID, squareTopology.region(RegionSize.of(3)), squareTopology);
}

// A domino of two cells in one row, around the origin.
function domino(): Piece<Color, SquareCoord> {
  return new Piece(new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]), RED);
}

const keysOf = (cells: readonly SquareCoord[]) => cells.map((c) => squareTopology.key(c));

// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.
describe('private fields of the board, the board shape, the piece and the piece id', () => {
  it('should_reject_at_compile_time_when_a_caller_reads_one_of_the_six_fields', () => {
    const board = squareBoard();
    const photo: ReadonlyBoard<Color, SquareCoord, SquareAxis> = board.clone();
    const shape = BoardShape.of([square(0, 0)]);
    const piece = domino();
    const readers = [
      // @ts-expect-error `BoardShape.cells` is private.
      () => shape.cells,
      // @ts-expect-error `Board.shape` is private.
      () => board.shape,
      // @ts-expect-error `Board.topology` is private.
      () => board.topology,
      // @ts-expect-error `ReadonlyBoard` shows no `shape`.
      () => photo.shape,
      // @ts-expect-error `ReadonlyBoard` shows no `topology`.
      () => photo.topology,
      // @ts-expect-error `Piece.shape` is private.
      () => piece.shape,
      // @ts-expect-error `Piece.content` is private.
      () => piece.content,
      // @ts-expect-error `PieceId.value` is private.
      () => PieceId.of('a').value,
    ];

    expect(readers).toHaveLength(8);
  });
});

describe('BoardShape operations', () => {
  it('should_give_its_coordinates_in_their_order_when_a_reader_asks_for_them', () => {
    const shape = BoardShape.of([4, 2, 0]);

    expect(shape.coordinates()).toEqual([4, 2, 0]);
  });

  // The shape gives a new list on each call, so a caller cannot change the shape through it.
  it('should_keep_its_coordinates_when_a_caller_changes_the_list_that_the_shape_gave', () => {
    const shape = BoardShape.of([0, 1]);

    shape.coordinates().push(2);
    shape.coordinates()[0] = 9;

    expect(shape.coordinates()).toEqual([0, 1]);
  });

  it('should_give_the_first_coordinate_when_the_shape_holds_one_coordinate_or_more', () => {
    expect(BoardShape.of([4, 2, 0]).first()).toBe(4);
    expect(BoardShape.of([7]).first()).toBe(7);
    expect(squareTopology.region(RegionSize.of(1)).first().equals(square(0, 0))).toBe(true);
  });

  it('should_give_one_key_for_each_coordinate_when_a_topology_names_them', () => {
    const shape = BoardShape.of([square(1, 0), square(0, 0), square(1, 0)]);

    expect(shape.keys(squareTopology)).toEqual(['1,0', '0,0', '1,0']);
  });
});

describe('Board operations', () => {
  it('should_give_the_axes_of_its_topology_when_the_board_is_on_each_of_the_three_topologies', () => {
    const onHexagons = new Board(BOARD_ID, hexTopology.region(RegionSize.of(1)), hexTopology);
    const onSquares = squareBoard();
    const onTriangles = new Board(
      BOARD_ID,
      triangleTopology.region(RegionSize.of(1)),
      triangleTopology,
    );

    expect(onHexagons.axes()).toEqual([HexAxis.q, HexAxis.r, HexAxis.s]);
    expect(onSquares.axes()).toEqual([SquareAxis.col, SquareAxis.row]);
    expect(onTriangles.axes()).toEqual(triangleTopology.axes());
    expect(onTriangles.axes().every((axis) => axis instanceof TriangleAxis)).toBe(true);
    expect(onTriangles.axes()).toHaveLength(3);
  });

  it('should_give_the_axes_when_a_reader_asks_the_board_of_a_photo', () => {
    const photo: ReadonlyBoard<Color, SquareCoord, SquareAxis> = squareBoard().clone();

    expect(photo.axes()).toEqual([SquareAxis.col, SquareAxis.row]);
  });

  it('should_give_the_full_turn_of_its_topology_when_the_board_is_on_each_of_the_three_topologies', () => {
    const onHexagons = new Board(BOARD_ID, hexTopology.region(RegionSize.of(1)), hexTopology);
    const onTriangles = new Board(
      BOARD_ID,
      triangleTopology.region(RegionSize.of(1)),
      triangleTopology,
    );

    expect(onHexagons.fullTurn()).toEqual(Turns.of(6));
    expect(squareBoard().fullTurn()).toEqual(Turns.of(4));
    expect(onTriangles.fullTurn()).toEqual(triangleTopology.fullTurn());
  });

  // The key names a coordinate inside the board and a coordinate outside it.
  it('should_give_the_topology_key_when_a_coordinate_lies_inside_or_outside_the_board', () => {
    const board = squareBoard();

    expect(board.key(square(2, 1))).toBe('2,1');
    expect(board.key(square(9, -4))).toBe(squareTopology.key(square(9, -4)));
    expect(board.contains(square(9, -4))).toBe(false);
  });

  it('should_give_every_coordinate_in_the_order_of_the_shape_when_cells_are_free_or_occupied', () => {
    const board = new Board<Color, SquareCoord, SquareAxis>(
      BOARD_ID,
      BoardShape.of([square(1, 0), square(0, 0), square(2, 0)]),
      squareTopology,
    );
    board.occupy(square(2, 0), RED);

    expect(keysOf(board.coordinates())).toEqual(['1,0', '0,0', '2,0']);
  });

  it('should_keep_its_coordinates_when_a_caller_changes_the_list_that_the_board_gave', () => {
    const board = squareBoard();

    board.coordinates().pop();

    expect(board.coordinates()).toHaveLength(9);
  });

  it('should_be_full_only_when_a_cell_occupies_every_coordinate', () => {
    const board = new Board<Color, SquareCoord, SquareAxis>(
      BOARD_ID,
      BoardShape.of([square(0, 0), square(1, 0)]),
      squareTopology,
    );
    const answers = [board.isFull()];

    board.occupy(square(0, 0), RED);
    answers.push(board.isFull());
    board.occupy(square(1, 0), RED);
    answers.push(board.isFull());
    board.vacate(square(0, 0));
    answers.push(board.isFull());

    expect(answers).toEqual([false, false, true, false]);
  });

  // The board moves the piece by its topology. It does not cut the piece at its edge:
  // a cell of the moved piece can lie outside the board, and `contains()` tells it.
  it('should_give_the_moved_piece_with_a_cell_outside_when_the_offset_is_at_the_edge', () => {
    const board = squareBoard();
    const piece = domino();

    const moved = board.moved(piece, square(2, 2));

    expect(keysOf(moved.cells())).toEqual(['2,2', '3,2']);
    expect(moved.cells().map((c) => board.contains(c))).toEqual([true, false]);
    expect(keysOf(piece.cells())).toEqual(['0,0', '1,0']);
    expect(board.cells()).toEqual([]);
  });

  it('should_give_the_turned_piece_when_the_board_turns_a_piece_by_its_topology', () => {
    const board = squareBoard();
    const piece = domino();

    const turned = board.turned(piece, Turns.of(1));

    expect(keysOf(turned.cells())).toEqual(
      keysOf(piece.rotated(Turns.of(1), squareTopology).cells()),
    );
    expect(keysOf(board.turned(piece, board.fullTurn()).cells())).toEqual(['0,0', '1,0']);
    expect(keysOf(piece.cells())).toEqual(['0,0', '1,0']);
  });

  it('should_keep_its_id_when_a_reader_asks_the_new_operations', () => {
    const board = squareBoard();
    const before = board.clone();

    board.axes();
    board.coordinates();
    board.isFull();
    board.moved(domino(), square(1, 1));

    expect(board.equals(before)).toBe(true);
    expect(board.clone().equals(board)).toBe(true);
  });
});

describe('Piece operations', () => {
  it('should_give_the_coordinates_that_it_covers_when_the_shape_is_a_group', () => {
    expect(keysOf(domino().cells())).toEqual(['0,0', '1,0']);
    expect(new Piece(new CellNode(hex(1, -1)), RED).cells()).toEqual([hex(1, -1)]);
  });

  it('should_give_the_cell_that_it_puts_on_the_board_when_a_reader_asks_for_it', () => {
    const id = PieceId.of('a');

    expect(domino().cell()).toBe(RED);
    expect(new Piece(new CellNode(square(0, 0)), id).cell()).toBe(id);
  });

  it('should_keep_its_cell_when_the_piece_is_turned_moved_or_copied', () => {
    const piece = domino();

    expect(piece.rotated(Turns.of(1), squareTopology).cell()).toBe(RED);
    expect(piece.translated(square(1, 1), squareTopology).cell()).toBe(RED);
    expect(piece.clone().cell()).toBe(RED);
  });
});

describe('PieceId text', () => {
  it('should_give_its_text_when_a_message_names_the_piece', () => {
    expect(String(PieceId.of('a'))).toBe('a');
    expect(`The piece ${PieceId.of('long-l')} is not on the figure.`).toBe(
      'The piece long-l is not on the figure.',
    );
  });
});
