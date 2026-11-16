import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SpaceView } from '../../adapters/space-state-mapper';
import { lip, palette, radius } from '../ui/theme';
import type { CellRenderer } from './cell-renderer';

// The default cell renderer of the game registry (D3, classes.md decision 14, issue #170).
// It draws inside the circle of the cell, so it fits every figure. A free space is a socket
// in the wood of the board: a dark hole with a light rim. An occupied space is a sun stone
// with a lip below it. The rim and the fill tell the two apart, not only the color.
// Each «Play … on the game screen» task (#174 to #177) registers the renderer of its variant
// in its place. The board carries the accessible name, so the screen reader skips each space.
export class SpaceCellRenderer implements CellRenderer<SpaceView> {
  render(cell: SpaceView): ReactNode {
    return (
      <View
        testID={cell.occupied ? 'space-occupied' : 'space-free'}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.space, cell.occupied ? styles.stone : styles.socket]}
      />
    );
  }
}

const styles = StyleSheet.create({
  space: {
    aspectRatio: 1,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  socket: {
    width: '78%',
    backgroundColor: palette.socket,
    borderColor: palette.trim,
  },
  stone: {
    width: '86%',
    backgroundColor: palette.sun,
    borderColor: palette.sunDeep,
    boxShadow: `0 ${lip.sm}px 0 ${palette.sunDeep}, inset 0 3px 0 rgba(255, 255, 255, 0.35)`,
  },
});
