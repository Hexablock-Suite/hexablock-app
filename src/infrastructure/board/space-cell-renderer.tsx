import type { ReactNode } from 'react';

import type { SpaceView } from '../../adapters/space-view';
import { lip, palette } from '../ui/theme';
import type { CellShape } from './board-layout';
import type { CellRenderer } from './cell-renderer';
import { CellOutline, type OutlineLayer } from './cell-outline';

// The share of the outline of the cell that a socket and a stone take.
// The rest is the wood of the board between two spaces.
const SOCKET_SCALE = 0.82;
const STONE_SCALE = 0.86;

// A socket in the wood of the board: a dark hole with a light rim.
const SOCKET: readonly OutlineLayer[] = [
  { scale: SOCKET_SCALE, fill: palette.socket, stroke: palette.trim, strokeWidth: 2 },
];

// A sun stone with a lip below it.
const STONE: readonly OutlineLayer[] = [
  { scale: STONE_SCALE, fill: palette.sunDeep, drop: lip.sm },
  { scale: STONE_SCALE, fill: palette.sun, stroke: palette.sunDeep, strokeWidth: 2 },
];

// The cell renderer of a free or an occupied space (D3, classes.md decision 14, issues #170 and #296).
// It draws the outline of the cell that the layout of the figure gives, so it fits every figure.
// A free space is a socket in the wood of the board: a dark hole with a light rim.
// An occupied space is a sun stone with a lip below it. The rim and the fill tell the two apart,
// not only the color. The game registry gives it to no game: the cell renderer of each variant
// holds one and draws a free space with it. The board carries the accessible name, so the screen
// reader skips each space.
export class SpaceCellRenderer implements CellRenderer<SpaceView> {
  render(cell: SpaceView, shape: CellShape): ReactNode {
    return (
      <CellOutline
        testID={cell.occupied ? 'space-occupied' : 'space-free'}
        shape={shape}
        layers={cell.occupied ? STONE : SOCKET}
      />
    );
  }
}
