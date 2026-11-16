import type { HexCoord } from '../../domain/engine/hex-topology';
import { valuesOf, type BoardLayout, type ScreenPoint } from './board-layout';

// √3 / 2: the height of a row of hexagons, in cell sizes.
const ROW_HEIGHT = Math.sqrt(3) / 2;

// The screen layout of the hexagon figure (issue #165). A hexagon points up,
// and the cells of one `r` value make a horizontal row.
// A step east, `q + 1`, moves one cell size to the right.
// A step south-east, `r + 1`, moves half a size to the right and √3/2 of a size down.
// So the circles of two neighbors touch, as `HexDirection` names the six neighbors.
export class HexLayout implements BoardLayout<HexCoord> {
  // `size` is the diameter of the circle inside a cell, in density-independent pixels.
  constructor(private readonly size: number) {}

  cellSize(): number {
    return this.size;
  }

  centerOf(at: HexCoord): ScreenPoint {
    const [q, r] = valuesOf(at);
    return { x: this.size * (q + r / 2), y: this.size * ROW_HEIGHT * r };
  }
}
