import type { ValueReceiver } from '../../domain/engine/value-receiver';

// A point on the screen, in density-independent pixels. `x` grows to the right, and `y` grows down.
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

// The screen layout of one board figure (D4, D11, classes.md decision 17, issues #165 and #296).
// The topology of the domain does the coordinate calculations of a figure.
// Its layout does the screen side in layer 3, so the domain knows no screen.
// The layout is a pure conversion, so it imports no package (docs/architecture/layers.md).
// One layout exists per figure: `HexLayout`, `SquareLayout` and `TriangleLayout`.
// `BoardView` reads only this interface, so it never branches on the figure.
// Each cell holds the largest circle that fits inside it. `cellSize()` gives the diameter
// of that circle, and `centerOf()` gives its center. The center of the origin cell is (0, 0).
// `outlineOf()` gives the corners of the cell around that center, clockwise on the screen.
// A hexagon has six corners, a square four and a triangle three. A triangle points up or down
// as its coordinate does. Two neighbor cells share one whole side, so the outlines of a board
// touch with no gap and no overlap.
export interface BoardLayout<TCoord> {
  cellSize(): number;
  centerOf(at: TCoord): ScreenPoint;
  outlineOf(at: TCoord): readonly ScreenPoint[];
}

// The shape of one cell in its box (issue #296). The box is the smallest rectangle
// that holds the outline. `corners` and `center` start at the top left corner of the box.
// `center` is the center of the circle inside the cell, and `inner` is the diameter of that circle.
// A cell renderer draws the outline from `corners` and puts a mark, such as a number, at `center`.
// `BoardView` hands the renderer a touch box of the side `inner` around the inner circle,
// so the renderer places the box of the shape over it, and the outline can reach past it.
export interface CellShape {
  readonly width: number;
  readonly height: number;
  readonly corners: readonly ScreenPoint[];
  readonly center: ScreenPoint;
  readonly inner: number;
}

// The box of the cell `at` of `layout`: its top left corner on the board and the shape in it.
export interface CellBox {
  readonly origin: ScreenPoint;
  readonly shape: CellShape;
}

// The box of the cell `at` of `layout`. It reads only the interface, so it serves every figure.
export function cellBoxOf<TCoord>(layout: BoardLayout<TCoord>, at: TCoord): CellBox {
  const center = layout.centerOf(at);
  const outline = layout.outlineOf(at);
  const xs = outline.map(({ x }) => x);
  const ys = outline.map(({ y }) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    origin: { x: center.x + left, y: center.y + top },
    shape: {
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
      corners: outline.map(({ x, y }) => ({ x: x - left, y: y - top })),
      center: { x: -left, y: -top },
      inner: layout.cellSize(),
    },
  };
}

// A coordinate that delivers its two values, as the three coordinates of the domain do.
export interface DeliversValues {
  deliverTo(receiver: ValueReceiver<readonly [number, number]>): void;
}

// The two values that `at` delivers. A coordinate that delivers none throws an Error.
export function valuesOf(at: DeliversValues): readonly [number, number] {
  let values: readonly [number, number] | undefined;
  at.deliverTo({
    receive: (delivered) => {
      values = delivered;
    },
  });
  if (values === undefined) throw new Error('The coordinate delivered no values.');
  return values;
}
