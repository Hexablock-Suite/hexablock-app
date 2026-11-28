import type { TriangleCoord } from '../../domain/engine/geometry/triangle-topology';
import { valuesOf, type BoardLayout, type ScreenPoint } from './board-layout';

// √3 / 2: the step between two triangles of one row, in cell sizes.
const COLUMN_STEP = Math.sqrt(3) / 2;
// The height of a row of triangles, in cell sizes.
const ROW_HEIGHT = 1.5;
// The circle of a down triangle sits half a size above the circle of an up triangle in its row.
const DOWN_SHIFT = 0.5;

// The corners of a triangle that points up, with an inner circle of diameter 1, clockwise
// from the top corner. The top corner is 1 above the center, and the bottom side 0.5 below it.
const UP_CORNERS = [
  { x: 0, y: -1 },
  { x: COLUMN_STEP, y: 0.5 },
  { x: -COLUMN_STEP, y: 0.5 },
];
// A triangle that points down is an up triangle upside down, clockwise from the top left corner.
const DOWN_CORNERS = [
  { x: -COLUMN_STEP, y: -0.5 },
  { x: COLUMN_STEP, y: -0.5 },
  { x: 0, y: 1 },
];

// The screen layout of the triangle figure (issues #165 and #296).
// A triangle has a side of √3 cell sizes and a height of 1.5 sizes.
// Each row is a strip of triangles that point up and down in turn (`TriangleCoord.isUp()`).
// A step of one column moves √3/2 of a size to the right, and a step of one row
// moves 1.5 sizes down. The circle of an up triangle sits 2/3 of the height below its top corner.
// The circle of a down triangle sits 1/3 of the height below its top side.
// So the circles of two neighbors touch, and two neighbor triangles share one side.
export class TriangleLayout implements BoardLayout<TriangleCoord> {
  // `size` is the diameter of the circle inside a cell, in density-independent pixels.
  constructor(private readonly size: number) {}

  cellSize(): number {
    return this.size;
  }

  centerOf(at: TriangleCoord): ScreenPoint {
    const [col, row] = valuesOf(at);
    const shift = at.isUp() ? 0 : DOWN_SHIFT;
    return { x: this.size * COLUMN_STEP * col, y: this.size * (ROW_HEIGHT * row - shift) };
  }

  // The outline of `at`: a triangle that points up or down as the coordinate does.
  outlineOf(at: TriangleCoord): readonly ScreenPoint[] {
    const corners = at.isUp() ? UP_CORNERS : DOWN_CORNERS;
    return corners.map(({ x, y }) => ({ x: this.size * x, y: this.size * y }));
  }
}
