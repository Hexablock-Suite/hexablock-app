import { cellBoxOf, type BoardLayout } from './board-layout';

// The largest cell size, up to `largest`, at which the board of `coords` fits in `width`
// density-independent pixels (issues #170 and #296). It reads only the layout of the figure,
// so it serves every figure. The layout of size 1 gives the width of the board in cell sizes:
// from the left side of the leftmost outline to the right side of the rightmost outline.
// A board with no coordinate takes `largest`, and a width of zero or less gives 0.
export function fittedCellSize<TCoord>(
  coords: readonly TCoord[],
  layoutOf: (size: number) => BoardLayout<TCoord>,
  width: number,
  largest: number,
): number {
  if (coords.length === 0) return largest;
  const unit = layoutOf(1);
  const boxes = coords.map((at) => cellBoxOf(unit, at));
  const left = Math.min(...boxes.map(({ origin }) => origin.x));
  const right = Math.max(...boxes.map(({ origin, shape }) => origin.x + shape.width));
  return Math.max(0, Math.min(largest, width / (right - left)));
}
