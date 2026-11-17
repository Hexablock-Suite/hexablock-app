import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { CellShape } from './board-layout';

// One layer of the drawing of a cell: the outline of the cell, made smaller toward the center
// of the cell by `scale` and moved `drop` points down, with its fill and its line.
export interface OutlineLayer {
  readonly scale: number;
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly drop?: number;
}

// The points of the outline of `shape` for one layer, as the text of an SVG polygon.
function pointsOf(shape: CellShape, { scale, drop = 0 }: OutlineLayer): string {
  const { center } = shape;
  return shape.corners
    .map(({ x, y }) => {
      const px = center.x + (x - center.x) * scale;
      const py = center.y + (y - center.y) * scale + drop;
      return `${px},${py}`;
    })
    .join(' ');
}

// Draws the outline of a cell in its box (issue #296). The layout of the figure gives
// the outline, so this drawing serves every figure: a hexagon, a square or a triangle.
// It draws each layer in its order, so a later layer covers an earlier one.
// It puts `children`, such as the number of a tile, on the circle inside the cell.
// It sits in the touch box of the cell, the square around the inner circle, and it reaches past
// that box to the whole outline. It takes no press, so a press outside the touch box reaches
// no space, and a press inside it reaches the box of `BoardView`.
// The board carries the accessible name, so the screen reader skips the cell.
export function CellOutline({
  shape,
  layers,
  testID,
  children,
}: {
  readonly shape: CellShape;
  readonly layers: readonly OutlineLayer[];
  readonly testID?: string;
  readonly children?: ReactNode;
}) {
  const { width, height, center, inner } = shape;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.drawing,
        { left: inner / 2 - center.x, top: inner / 2 - center.y, width, height },
      ]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {layers.map((layer, index) => (
          <Polygon
            key={index}
            points={pointsOf(shape, layer)}
            fill={layer.fill}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      <View
        pointerEvents="none"
        style={[
          styles.mark,
          { left: center.x - inner / 2, top: center.y - inner / 2, width: inner, height: inner },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawing: {
    position: 'absolute',
    overflow: 'visible',
  },
  mark: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
