import type { HexCoord } from '../../domain/engine/hex-topology';
import { valuesOf, type BoardLayout, type ScreenPoint } from './board-layout';

// √3 / 2: the height of a row of hexagons, in cell sizes.
const ROW_HEIGHT = Math.sqrt(3) / 2;

// The corners of a hexagon with an inner circle of diameter 1, clockwise from the top corner.
// The hexagon is 1 wide between its two vertical sides and 2/√3 high between its top
// and bottom corners.
const HEX_CORNERS = [-90, -30, 30, 90, 150, 210].map((degrees) => {
  const angle = (degrees * Math.PI) / 180;
  return { x: Math.cos(angle) / Math.sqrt(3), y: Math.sin(angle) / Math.sqrt(3) };
});

// The screen layout of the hexagon figure (issues #165 and #296). A hexagon points up,
// and the cells of one `r` value make a horizontal row.
// A step east, `q + 1`, moves one cell size to the right.
// A step south-east, `r + 1`, moves half a size to the right and √3/2 of a size down.
// So the circles of two neighbors touch, and two neighbor hexagons share one side.
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

  // Every hexagon has the same outline: it points up.
  outlineOf(): readonly ScreenPoint[] {
    return HEX_CORNERS.map(({ x, y }) => ({ x: this.size * x, y: this.size * y }));
  }
}
