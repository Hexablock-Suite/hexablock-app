import { StyleSheet, View } from 'react-native';

import type { MoveResult } from '../../application/move-result';
import type { BoardLayout } from './board-layout';
import type { CellRenderer } from './cell-renderer';

export interface BoardViewProps<TCellView, TCoord> {
  // The cells of the plain response of layer 2 (classes.md decision 29).
  readonly cells: MoveResult<TCellView, TCoord>['cells'];
  // The screen layout of the board figure.
  readonly layout: BoardLayout<TCoord>;
  // The cell renderer of the variant.
  readonly renderer: CellRenderer<TCellView>;
}

// Draws the cells of a board of any figure (D3, D4, issue #165).
// It reads the cells from `MoveResult` and never calls a method of `Board` or of a photo (#234).
// The layout of the figure gives the place of each cell, and the renderer of the variant
// draws the cell in a square box at that place. `BoardView` never asks which figure
// or which game it draws, so it holds no branch on them.
// The frame of the board wraps the boxes of the cells that it draws.
// So the leftmost box starts at the left side of the frame, and the topmost box at its top side.
// The center of each cell is unique, so it is also the React key of the box.
export function BoardView<TCellView, TCoord>({
  cells,
  layout,
  renderer,
}: BoardViewProps<TCellView, TCoord>) {
  const size = layout.cellSize();
  const placed = cells.map(([at, cell]) => ({ center: layout.centerOf(at), cell }));
  const xs = placed.map(({ center }) => center.x);
  const ys = placed.map(({ center }) => center.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  // With no cell, the minimum is Infinity and the maximum is -Infinity, so the frame is empty.
  const width = Math.max(0, Math.max(...xs) - left + size);
  const height = Math.max(0, Math.max(...ys) - top + size);
  return (
    <View style={[styles.board, { width, height }]}>
      {placed.map(({ center, cell }) => (
        <View
          key={`${center.x},${center.y}`}
          style={[
            styles.cell,
            { left: center.x - left, top: center.y - top, width: size, height: size },
          ]}
        >
          {renderer.render(cell)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    position: 'relative',
  },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
