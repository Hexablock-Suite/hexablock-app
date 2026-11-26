import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { MergeCellView } from '../../adapters/merge-state-mapper';
import { lip, palette, serif, tileTone } from '../ui/theme';
import type { CellShape } from './board-layout';
import type { CellRenderer } from './cell-renderer';
import { CellOutline } from './cell-outline';
import { SpaceCellRenderer } from './space-cell-renderer';

// The size of the number of a tile for each count of digits, from one digit up.
// A tile of five digits or more takes the last size.
const NUMBER_SIZES = [20, 18, 15, 12, 10];

// The share of the outline of the cell that a tile takes.
const TILE_SCALE = 0.88;

// The cell renderer of Hexa Merge (D3, classes.md decision 14, issues #177 and #296). The game
// registry pairs it with `MergeStateMapper`. A free space is the socket of `SpaceCellRenderer`.
// A tile is a stone in the outline of the cell, in the tone of its value with its number,
// and a lip below it. The layout of the figure gives the outline, so it fits every figure.
// The number and the tone tell two values apart, not only the color.
// The test ids of `SpaceCellRenderer` stay, so a test counts the spaces of every game alike.
// The board carries the accessible name, so the screen reader skips each space.
export class MergeCellRenderer implements CellRenderer<MergeCellView> {
  private readonly spaces = new SpaceCellRenderer();

  render(cell: MergeCellView, shape: CellShape): ReactNode {
    return cell.value === undefined ? (
      this.spaces.render({ occupied: false }, shape)
    ) : (
      <MergeTileStone value={cell.value} shape={shape} />
    );
  }
}

// The stone of one tile. Each doubling of the value takes the next tone.
// The number sits on the circle inside the cell.
function MergeTileStone({ value, shape }: { readonly value: number; readonly shape: CellShape }) {
  const tone = tileTone(Math.log2(value) - 1);
  const digits = String(value).length;
  return (
    <CellOutline
      testID="space-occupied"
      shape={shape}
      layers={[
        { scale: TILE_SCALE, fill: palette.shade, drop: lip.sm },
        { scale: TILE_SCALE, fill: tone.face, stroke: palette.shade, strokeWidth: 2 },
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[
          styles.number,
          { color: tone.ink, fontSize: NUMBER_SIZES[Math.min(digits, NUMBER_SIZES.length) - 1] },
        ]}
      >
        {value}
      </Text>
    </CellOutline>
  );
}

const styles = StyleSheet.create({
  number: {
    fontFamily: serif,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
});
