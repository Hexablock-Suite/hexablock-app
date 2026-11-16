import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FitCellView } from '../../adapters/fit-state-mapper';
import type { SpaceView } from '../../adapters/space-state-mapper';
import { lip, palette, radius, worldTone, type WorldTone } from '../ui/theme';
import type { CellRenderer } from './cell-renderer';
import { SpaceCellRenderer } from './space-cell-renderer';

const FREE_SPACE: SpaceView = Object.freeze({ occupied: false });

// The cell renderer of Hexa Fit (D3, classes.md decision 14, issue #175). The game registry
// of the composition root pairs it with `FitStateMapper`, so both name `FitCellView`.
// A free space of the figure is the socket of the default renderer. A space that a piece covers
// is a stone in the color of the piece, with a light rim and a lip below it. So the spaces of one
// piece share one color, and the rim parts two pieces that touch.
// It draws inside the circle of the cell, so it fits every figure. The board carries
// the accessible name, so the screen reader skips each space.
export class FitCellRenderer implements CellRenderer<FitCellView> {
  private readonly spaces = new SpaceCellRenderer();

  render(cell: FitCellView): ReactNode {
    if (cell.piece === undefined) return this.spaces.render(FREE_SPACE);
    return (
      <View
        testID="space-occupied"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.space}
      >
        <PieceStone piece={cell.piece} />
      </View>
    );
  }
}

// The stone of one space of the piece `piece`. It fills its parent.
// The tray marks the origin of a piece with `anchor`: a place move puts that space
// on the space that the player presses.
export function PieceStone({
  piece,
  anchor = false,
}: {
  readonly piece: string;
  readonly anchor?: boolean;
}) {
  const colors = pieceTone(piece);
  return (
    <View style={[styles.stone, { backgroundColor: colors.tone, borderColor: colors.wash }]}>
      {anchor ? <View style={styles.anchor} /> : null}
    </View>
  );
}

// The colors of the piece `piece`: one of the world colors, chosen by the text of its id.
// The bundled levels name their pieces `a`, `b`, `c` and so on, so the pieces of one level
// take different colors.
function pieceTone(piece: string): WorldTone {
  return worldTone([...piece].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0));
}

const styles = StyleSheet.create({
  space: {
    width: '90%',
    aspectRatio: 1,
  },
  stone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    boxShadow: `0 ${lip.sm}px 0 ${palette.shade}, inset 0 3px 0 rgba(255, 255, 255, 0.3)`,
  },
  anchor: {
    width: '38%',
    aspectRatio: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    backgroundColor: palette.white,
  },
});
