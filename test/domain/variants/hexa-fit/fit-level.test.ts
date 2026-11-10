/** @jest-environment node */
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { TopologyId } from '../../../../src/domain/engine/geometry-factory';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import type { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { A, B } from '../../../support/variants/hexa-fit/fit-game';

// A Fit level is a value object that guards its own invariant (issue 208, classes.md decision 46).

type FitPiece = Piece<PieceId, SquareCoord>;

function domino(id: PieceId, col = 0): FitPiece {
  return new Piece(
    new ShapeGroup([new CellNode(square(col, 0)), new CellNode(square(col + 1, 0))]),
    id,
  );
}

function row(length: number): BoardShape<SquareCoord> {
  return BoardShape.of(Array.from({ length }, (_, col) => square(col, 0)));
}

function ids(level: FitLevel<SquareCoord>): string[] {
  return level.trayPieces().map((piece) => piece.content.value);
}

describe('FitLevel', () => {
  it('should_throw_a_range_error_when_the_level_gets_two_pieces_with_one_id', () => {
    const create = () => FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B), domino(A)]);

    expect(create).toThrow(new RangeError('The level has two pieces with the id a.'));
  });

  it('should_throw_a_range_error_when_the_level_pieces_hold_undefined', () => {
    // Only a cast or a sparse list puts `undefined` in the pieces, as a broken level file would.
    const pieces = [domino(A), undefined] as unknown as FitPiece[];

    const create = () => FitLevel.of(TopologyId.square, row(2), pieces);

    expect(create).toThrow(new RangeError('A piece list cannot hold undefined.'));
  });

  it('should_keep_its_pieces_when_the_array_that_built_the_level_changes', () => {
    const pieces = [domino(A)];
    const level = FitLevel.of(TopologyId.square, row(4), pieces);

    pieces.push(domino(A));
    pieces[0] = domino(B);

    expect(ids(level)).toEqual(['a']);
  });

  it('should_refuse_a_write_when_a_caller_changes_the_level_or_its_piece_list', () => {
    const level = FitLevel.of(TopologyId.square, row(4), [domino(A)]);

    expect(Object.isFrozen(level)).toBe(true);
    expect(Reflect.set(level, 'pieces', [])).toBe(false);
    expect(Reflect.set(level.trayPieces(), 0, domino(B))).toBe(false);
    expect(ids(level)).toEqual(['a']);
  });

  it('should_be_equal_when_two_levels_hold_the_same_data', () => {
    const one = FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)]);
    const other = FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)]);

    expect(one).not.toBe(other);
    expect(one.equals(other, squareTopology)).toBe(true);
    expect(other.equals(one, squareTopology)).toBe(true);
  });

  it('should_not_be_equal_when_two_levels_differ_in_one_part', () => {
    const level = FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)]);
    const others = [
      FitLevel.of(TopologyId.hex, row(4), [domino(A), domino(B, 2)]),
      FitLevel.of(TopologyId.square, row(5), [domino(A), domino(B, 2)]),
      FitLevel.of(TopologyId.square, row(4), [domino(A)]),
      FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B)]),
      // The tray keeps the order of the level, so the order of the pieces counts.
      FitLevel.of(TopologyId.square, row(4), [domino(B, 2), domino(A)]),
    ];

    for (const other of others) {
      expect(level.equals(other, squareTopology)).toBe(false);
      expect(other.equals(level, squareTopology)).toBe(false);
    }
  });

  it('should_tell_its_geometry_family_when_a_factory_asks_the_level', () => {
    const level = FitLevel.of(TopologyId.square, row(2), [domino(A)]);

    expect(level.isOf(TopologyId.square)).toBe(true);
    expect(level.isOf(TopologyId.hex)).toBe(false);
    expect(level.wrongFamily(TopologyId.hex)).toEqual(
      new RangeError('A Fit level of topology square cannot start on the hex geometry.'),
    );
  });

  it('should_give_its_figure_as_a_tree_of_cells_when_a_factory_asks_the_level', () => {
    const level = FitLevel.of(TopologyId.square, row(3), []);

    const cells = level.figureTree().cells();

    expect(cells.map((c) => squareTopology.key(c))).toEqual(['0,0', '1,0', '2,0']);
  });
});
