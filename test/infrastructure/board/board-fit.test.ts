/** @jest-environment node */
import { hex } from '../../../src/domain/engine/hex-topology';
import { square } from '../../../src/domain/engine/square-topology';
import { fittedCellSize } from '../../../src/infrastructure/board/board-fit';
import { HexLayout } from '../../../src/infrastructure/board/hex-layout';
import { SquareLayout } from '../../../src/infrastructure/board/square-layout';

// Issue #170: the game screen draws the whole board in the width of the screen.
// `fittedCellSize()` reads only the layout of the figure, so it fits every figure.

const hexLayoutOf = (size: number) => new HexLayout(size);
const squareLayoutOf = (size: number) => new SquareLayout(size);

describe('fittedCellSize', () => {
  // A row of nine hexagons is nine cell sizes wide: the centers lie eight sizes apart,
  // and each end adds half a size.
  it('should_give_the_size_at_which_the_widest_row_fills_the_width_when_the_board_is_too_wide', () => {
    const row = Array.from({ length: 9 }, (_, q) => hex(q - 4, 0));

    expect(fittedCellSize(row, hexLayoutOf, 270, 48)).toBeCloseTo(30, 9);
  });

  it('should_give_the_largest_size_when_the_board_fits_at_that_size', () => {
    const board = [square(0, 0), square(1, 0), square(2, 3)];

    expect(fittedCellSize(board, squareLayoutOf, 400, 48)).toBe(48);
  });

  it('should_give_the_largest_size_when_the_board_has_no_space_yet', () => {
    expect(fittedCellSize([], hexLayoutOf, 100, 48)).toBe(48);
  });

  it('should_give_no_size_when_the_width_is_zero_or_less', () => {
    expect(fittedCellSize([hex(0, 0)], hexLayoutOf, -10, 48)).toBe(0);
  });
});
