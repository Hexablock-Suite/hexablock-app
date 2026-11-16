import type { BoardLayout } from './board-layout';

// The largest cell size, up to `largest`, at which the board of `coords` fits in `width`
// density-independent pixels (issue #170). It reads only the layout of the figure,
// so it serves every figure. The layout of size 1 gives the width of the board in cell sizes:
// the distance between the outer centers, and half a cell at each end.
// A board with no coordinate takes `largest`, and a width of zero or less gives 0.
export function fittedCellSize<TCoord>(
  coords: readonly TCoord[],
  layoutOf: (size: number) => BoardLayout<TCoord>,
  width: number,
  largest: number,
): number {
  if (coords.length === 0) return largest;
  const unit = layoutOf(1);
  const xs = coords.map((at) => unit.centerOf(at).x);
  const span = Math.max(...xs) - Math.min(...xs) + unit.cellSize();
  return Math.max(0, Math.min(largest, width / span));
}
