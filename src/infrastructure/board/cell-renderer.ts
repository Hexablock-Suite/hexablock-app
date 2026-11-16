import type { ReactNode } from 'react';

// Strategy (D3, classes.md decision 14, issue #165): draws the content of one cell of a variant.
// `BoardView` places each cell and hands the cell to the renderer of the variant.
// The renderer draws inside a square box with the side `BoardLayout.cellSize()`.
// The circle of the cell touches the four sides of that box, so one renderer serves every figure.
// `TCellView` is the data of one cell for the screen. By S3-07 in #151 («Propuesta, pendiente
// del equipo»), the game registry of the composition root will choose the renderer of each game.
// No renderer of a variant exists yet.
export interface CellRenderer<TCellView> {
  render(cell: TCellView): ReactNode;
}
