import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FitCellView } from '../../adapters/fit-state-mapper';
import type { SpaceView } from '../../adapters/space-view';
import { lip, palette, radius, worldTone, type WorldTone } from '../ui/theme';
import type { CellShape } from '../../adapters/board/board-layout';
import type { CellRenderer } from './cell-renderer';
import { CellOutline } from './cell-outline';
import { SpaceCellRenderer } from './space-cell-renderer';

const FREE_SPACE: SpaceView = Object.freeze({ occupied: false });

// The share of the outline of the cell that the stone of a piece takes.
const STONE_SCALE = 0.9;

// The cell renderer of Hexa Fit (D3, classes.md decision 14, issues #175 and #296). The game
// registry of the composition root pairs it with `FitStateMapper`, so both name `FitCellView`.
// A free space of the figure is the socket of `SpaceCellRenderer`. A space that a piece covers
// is a stone in the color of the piece, with a light rim and a lip below it. So the spaces of one
// piece share one color, and the rim parts two pieces that touch.
// It draws the outline of the cell that the layout of the figure gives, so it fits every figure.
// The board carries the accessible name, so the screen reader skips each space.
export class FitCellRenderer implements CellRenderer<FitCellView> {
  private readonly spaces = new SpaceCellRenderer();

  render(cell: FitCellView, shape: CellShape): ReactNode {
    if (cell.piece === undefined) return this.spaces.render(FREE_SPACE, shape);
    return <PieceStone testID="space-occupied" piece={cell.piece} shape={shape} />;
  }
}

// The stone of one space of the piece `piece`, in the outline of `shape`.
// The tray marks the origin of a piece with `anchor`: a place move puts that space
// on the space that the player presses.
export function PieceStone({
  piece,
  shape,
  anchor = false,
  testID,
}: {
  readonly piece: string;
  readonly shape: CellShape;
  readonly anchor?: boolean;
  readonly testID?: string;
}) {
  const colors = pieceTone(piece);
  return (
    <CellOutline
      testID={testID}
      shape={shape}
      layers={[
        { scale: STONE_SCALE, fill: palette.shade, drop: lip.sm },
        { scale: STONE_SCALE, fill: colors.tone, stroke: colors.wash, strokeWidth: 2 },
      ]}
    >
      {anchor ? <View style={styles.anchor} /> : null}
    </CellOutline>
  );
}

// The colors of the piece `piece`: one of the world colors, chosen by the text of its id.
// The bundled levels name their pieces `a`, `b`, `c` and so on, so the pieces of one level
// take different colors.
function pieceTone(piece: string): WorldTone {
  return worldTone([...piece].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0));
}

const styles = StyleSheet.create({
  anchor: {
    width: '38%',
    aspectRatio: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    backgroundColor: palette.white,
  },
});
