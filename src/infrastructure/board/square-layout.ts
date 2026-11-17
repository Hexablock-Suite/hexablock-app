import type { SquareCoord } from '../../domain/engine/square-topology';
import { valuesOf, type BoardLayout, type ScreenPoint } from './board-layout';

// The corners of a square with a side of 1, clockwise from the top left corner.
const SQUARE_CORNERS = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
];

// The screen layout of the square figure (issues #165 and #296).
// A step of one column moves one cell size to the right, and a step of one row
// moves one cell size down. So the circles of two neighbors touch,
// and two neighbor squares share one side.
export class SquareLayout implements BoardLayout<SquareCoord> {
  // `size` is the side of a cell and the diameter of its circle, in density-independent pixels.
  constructor(private readonly size: number) {}

  cellSize(): number {
    return this.size;
  }

  centerOf(at: SquareCoord): ScreenPoint {
    const [col, row] = valuesOf(at);
    return { x: this.size * col, y: this.size * row };
  }

  // Every square has the same outline.
  outlineOf(): readonly ScreenPoint[] {
    return SQUARE_CORNERS.map(({ x, y }) => ({ x: this.size * x, y: this.size * y }));
  }
}
