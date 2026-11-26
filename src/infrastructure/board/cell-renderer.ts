import type { ReactNode } from 'react';

import type { CellShape } from '../../adapters/board/board-layout';

// Strategy (D3, classes.md decision 14, issues #165 and #296): draws one cell of a variant.
// `BoardView` places each cell and hands the cell and its shape to the renderer of the variant.
// The renderer draws in the touch box of the cell, the square around its inner circle,
// and it draws the outline that the shape gives over that box. The outline takes no press.
// The layout of the figure gives that outline, so one renderer serves every figure.
// `TCellView` is the data of one cell for the screen. By S3-07 in #151 («Propuesta, pendiente
// del equipo»), the game registry of the composition root chooses the renderer of each game.
// `FitCellRenderer` (#175) and `MergeCellRenderer` (#177) are the renderers of their variants.
export interface CellRenderer<TCellView> {
  render(cell: TCellView, shape: CellShape): ReactNode;
}
