import type { SquareCoord } from '../../domain/engine/square-topology';
import { valuesOf, type BoardLayout, type ScreenPoint } from './board-layout';

// The screen layout of the square figure (issue #165).
// A step of one column moves one cell size to the right, and a step of one row
// moves one cell size down. So the circles of two neighbors touch.
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
}
