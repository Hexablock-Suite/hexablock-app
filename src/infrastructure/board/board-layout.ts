import type { ValueReceiver } from '../../domain/engine/value-receiver';

// A point on the screen, in density-independent pixels. `x` grows to the right, and `y` grows down.
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

// The screen layout of one board figure (D4, D11, classes.md decision 17, issue #165).
// The topology of the domain does the coordinate calculations of a figure.
// Its layout does the screen side in layer 4, so the domain knows no screen.
// One layout exists per figure: `HexLayout`, `SquareLayout` and `TriangleLayout`.
// `BoardView` reads only this interface, so it never branches on the figure.
// Each cell holds the largest circle that fits inside it. `cellSize()` gives the diameter
// of that circle, and `centerOf()` gives its center. The center of the origin cell is (0, 0).
// The circles of two neighbor cells touch, so a cell renderer that draws inside the circle
// fits every figure.
export interface BoardLayout<TCoord> {
  cellSize(): number;
  centerOf(at: TCoord): ScreenPoint;
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
