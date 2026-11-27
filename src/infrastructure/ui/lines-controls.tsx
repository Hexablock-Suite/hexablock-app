import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LinesIntent } from '../../adapters/lines-move-mapper';
import type { LinesCellView, LinesPayloadView } from '../../adapters/lines-state-mapper';
import { fittedCellSize } from '../../adapters/board/board-fit';
import { cellBoxOf } from '../../adapters/board/board-layout';
import { BoardView } from '../board/board-view';
import type { CellRenderer } from '../board/cell-renderer';
import { LinesStone } from '../board/lines-cell-renderer';
import type { MoveControls, MoveControlsProps } from './move-controls';
import { palette, radius, serif, space } from './theme';
import { WoodSign } from './wood';

type LinesProps<TCoord> = MoveControlsProps<
  TCoord,
  LinesCellView,
  LinesPayloadView<TCoord>,
  LinesIntent<TCoord>
>;

const PREVIEW = 44;
const PREVIEW_RENDERER: CellRenderer<string> = {
  render: (color, shape) => <LinesStone color={color} shape={shape} />,
};

// The move controls of Hexa Lines (classes.md decision 14, issue #174). The player picks
// a piece of the tray and presses a space. The press sends a `LinesIntent` through
// `GamePresenter.onMove()`: the index of the piece and the pressed space (#405).
// `LinesMoveMapper` of layer 3 builds the `PlacePiece`, with the step of the board figure
// from the pressed space to the offset of the move.
export class LinesControls<TCoord> implements MoveControls<
  TCoord,
  LinesCellView,
  LinesPayloadView<TCoord>,
  LinesIntent<TCoord>
> {
  render(props: LinesProps<TCoord>) {
    return <LinesPlay {...props} />;
  }
}

function LinesPlay<TCoord>({ model, texts, layoutOf, play, board }: LinesProps<TCoord>) {
  const [choice, choose] = useState<{ tray: LinesPayloadView<TCoord>['tray']; index: number }>();
  const tray = model.payload?.tray;
  // The presenter keeps the tray on rejection and replaces it on success.
  const selected = choice?.tray === tray ? choice?.index : undefined;
  return (
    <>
      {board((at) => {
        if (selected !== undefined) play({ position: selected, at });
      })}
      {tray === undefined ? null : (
        <WoodSign>
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {texts[selected === undefined ? 'play.lines.hint.pick' : 'play.lines.hint.place']}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={texts['play.lines.tray']}
            style={styles.tray}
          >
            {tray.map((piece, index) => {
              const label = `${texts['play.lines.piece']} ${index + 1}`;
              const unit = layoutOf(1);
              const boxes = piece.cells.map((at) => cellBoxOf(unit, at));
              const height =
                Math.max(...boxes.map(({ origin, shape }) => origin.y + shape.height)) -
                Math.min(...boxes.map(({ origin }) => origin.y));
              const size = Math.min(
                fittedCellSize(piece.cells, layoutOf, PREVIEW, PREVIEW),
                PREVIEW / height,
              );
              const checked = index === selected;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked }}
                  onPress={() => choose(checked ? undefined : { tray, index })}
                  style={[styles.piece, checked && styles.selected]}
                >
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <BoardView
                      cells={piece.cells.map((at) => [at, piece.color] as const)}
                      layout={layoutOf(size)}
                      renderer={PREVIEW_RENDERER}
                      label={label}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </WoodSign>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: palette.ink, fontFamily: serif, fontSize: 14, textAlign: 'center' },
  tray: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.sm },
  piece: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    borderColor: palette.trim,
    borderWidth: 2,
    borderRadius: radius.md,
  },
  selected: { backgroundColor: palette.sun, borderColor: palette.sunDeep },
});
