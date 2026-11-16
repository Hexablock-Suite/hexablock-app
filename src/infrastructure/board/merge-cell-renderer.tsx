import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MergeCellView } from '../../adapters/merge-state-mapper';
import { lip, palette, radius, serif, tileTone } from '../ui/theme';
import type { CellRenderer } from './cell-renderer';
import { SpaceCellRenderer } from './space-cell-renderer';

// The size of the number of a tile for each count of digits, from one digit up.
// A tile of five digits or more takes the last size.
const NUMBER_SIZES = [20, 18, 15, 12, 10];

// The cell renderer of Hexa Merge (D3, classes.md decision 14, issue #177). The game registry
// pairs it with `MergeStateMapper`. A free space is the socket of the default renderer.
// A tile is a round stone in the tone of its value with its number, and a lip below it.
// The number and the tone tell two values apart, not only the color.
// The test ids of the default renderer stay, so a test counts the spaces of every game alike.
// The board carries the accessible name, so the screen reader skips each space.
export class MergeCellRenderer implements CellRenderer<MergeCellView> {
  private readonly spaces = new SpaceCellRenderer();

  render(cell: MergeCellView): ReactNode {
    return cell.value === undefined ? (
      this.spaces.render({ occupied: false })
    ) : (
      <MergeTileStone value={cell.value} />
    );
  }
}

// The stone of one tile. Each doubling of the value takes the next tone.
function MergeTileStone({ value }: { readonly value: number }) {
  const tone = tileTone(Math.log2(value) - 1);
  const digits = String(value).length;
  return (
    <View
      testID="space-occupied"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { backgroundColor: tone.face }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '86%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.shade,
    boxShadow: `0 ${lip.sm}px 0 ${palette.shade}, inset 0 3px 0 rgba(255, 255, 255, 0.35)`,
  },
  number: {
    fontFamily: serif,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
});
