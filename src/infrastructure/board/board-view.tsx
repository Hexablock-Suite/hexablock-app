import { Pressable, StyleSheet, View } from 'react-native';

import { cellBoxOf, type BoardLayout } from './board-layout';
import type { CellRenderer } from './cell-renderer';

export interface BoardViewProps<TCellView, TCoord> {
  // One pair of a coordinate and a cell view for each space to draw: the `cells` of
  // `GameViewModel` (#170). The state mapper of the game builds each cell view.
  readonly cells: readonly (readonly [TCoord, TCellView])[];
  // The screen layout of the board figure.
  readonly layout: BoardLayout<TCoord>;
  // The cell renderer of the variant.
  readonly renderer: CellRenderer<TCellView>;
  // The accessible name of the board, a text of the catalog (APP-FR-11).
  readonly label: string;
  // Takes a press on a space: the coordinate and the cell view of the space (#175).
  // The move controls of a variant give it. A board with no handler plays nothing.
  readonly onPressSpace?: (at: TCoord, cell: TCellView) => void;
}

// The handler of a board with no move controls: a press plays nothing.
function ignoreSpace(): void {}

// Draws the cells of a board of any figure (D3, D4, issues #165 and #296).
// It reads only the pairs that it takes and never calls a method of `Board` or of a photo (#234).
// The layout of the figure gives the place and the outline of each cell.
// Each cell gets a square touch box around its inner circle, with the side `cellSize()`.
// The touch boxes of two neighbors hold no center of the other, so a press never reaches
// a neighbor. The renderer of the variant draws the cell and its outline over that box,
// and the outline can reach past it (#296). `BoardView` never asks which figure
// or which game it draws, so it holds no branch on them.
// The frame of the board wraps the outlines of the cells that it draws.
// So the leftmost outline starts at the left side of the frame, and the topmost at its top side.
// The center of each cell is unique, so it is also the React key of the box.
// Each box takes a press and hands its coordinate and its cell view to `onPressSpace` (#175).
// The board carries the accessible name, so the screen reader skips each box.
export function BoardView<TCellView, TCoord>({
  cells,
  layout,
  renderer,
  label,
  onPressSpace = ignoreSpace,
}: BoardViewProps<TCellView, TCoord>) {
  const size = layout.cellSize();
  const placed = cells.map(([at, cell]) => ({
    at,
    cell,
    center: layout.centerOf(at),
    ...cellBoxOf(layout, at),
  }));
  const left = Math.min(...placed.map(({ origin }) => origin.x));
  const top = Math.min(...placed.map(({ origin }) => origin.y));
  // With no cell, the minimum is Infinity and the maximum is -Infinity, so the frame is empty.
  const width = Math.max(
    0,
    Math.max(...placed.map(({ origin, shape }) => origin.x + shape.width)) - left,
  );
  const height = Math.max(
    0,
    Math.max(...placed.map(({ origin, shape }) => origin.y + shape.height)) - top,
  );
  return (
    <View accessibilityLabel={label} style={[styles.board, { width, height }]}>
      {placed.map(({ at, cell, center, shape }) => (
        <Pressable
          key={`${center.x},${center.y}`}
          accessible={false}
          onPress={() => onPressSpace(at, cell)}
          style={[
            styles.cell,
            {
              left: center.x - size / 2 - left,
              top: center.y - size / 2 - top,
              width: size,
              height: size,
            },
          ]}
        >
          {renderer.render(cell, shape)}
        </Pressable>
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
