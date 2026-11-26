import { View } from 'react-native';

import type { CellShape } from '../../adapters/board/board-layout';
import { CellOutline, type OutlineLayer } from '../board/cell-outline';
import { lip, palette, type WorldTone } from './theme';

// The share of the outline of a stone that its light inner face takes.
const WASH_SCALE = 0.56;

// Draws the layers of `shape`, the shape of a board figure, in its box, plus `below` points
// under it for a lip (issue #297). `useFigureShapes()` gives the shape from the layout
// of the figure, as the board draws its cells (#296), so this drawing serves every figure.
// The drawing is decoration: the screen reader skips it.
export function FigureOutline({
  shape,
  layers,
  below = 0,
  testID,
}: {
  readonly shape: CellShape;
  readonly layers: readonly OutlineLayer[];
  readonly below?: number;
  readonly testID?: string;
}) {
  const { width, height, center, inner } = shape;
  return (
    <View
      style={{ width, height: height + below }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          position: 'absolute',
          left: center.x - inner / 2,
          top: center.y - inner / 2,
          width: inner,
          height: inner,
        }}
      >
        <CellOutline testID={testID} shape={{ ...shape, height: height + below }} layers={layers} />
      </View>
    </View>
  );
}

// The stone of one world in `shape`, the shape of a board figure (issue #297): a shade below it,
// the stone in its tone and a light inner face. A pressed stone sinks onto its shade.
// The stone is decoration: the screen reader skips it.
export function FigureStone({
  shape,
  colors,
  pressed = false,
}: {
  readonly shape: CellShape;
  readonly colors: WorldTone;
  readonly pressed?: boolean;
}) {
  const drop = pressed ? lip.md : 0;
  return (
    <FigureOutline
      testID="figure-stone"
      shape={shape}
      below={lip.md}
      layers={[
        { scale: 1, fill: palette.shade, drop: lip.md },
        { scale: 1, fill: colors.tone, drop },
        { scale: WASH_SCALE, fill: colors.wash, drop },
      ]}
    />
  );
}
