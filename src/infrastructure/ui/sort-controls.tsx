import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SortIntent } from '../../adapters/sort-move-mapper';
import type { SortCellView, SortPayloadView } from '../../adapters/sort-state-mapper';
import type { CellShape } from '../../adapters/board/board-layout';
import { StackStone } from '../board/sort-cell-renderer';
import type { MoveControls, MoveControlsProps } from './move-controls';
import { palette, radius, serif, space } from './theme';
import { WoodSign } from './wood';

type SortProps<TCoord> = MoveControlsProps<
  TCoord,
  SortCellView,
  SortPayloadView,
  SortIntent<TCoord>
>;

// The move controls of Hexa Sort (classes.md decision 14, issue #176). A press on a free space
// sends a `SortIntent` with that space through `GamePresenter.onMove()` (#405), and
// `SortMoveMapper` of layer 3 builds the `PlaceStack`.
export class SortControls<TCoord> implements MoveControls<
  TCoord,
  SortCellView,
  SortPayloadView,
  SortIntent<TCoord>
> {
  constructor(private readonly preview: CellShape) {}

  render({ model, texts, play, board }: SortProps<TCoord>): ReactNode {
    const payload = model.payload;
    const offered = payload?.offered;
    const onPressSpace = (at: TCoord, cell: SortCellView) => {
      // There is only one offer. A free space plays it without a tray choice.
      if (offered !== undefined && cell.colors.length === 0) play({ at });
    };

    return (
      <>
        {board(onPressSpace)}
        {payload === undefined ? null : (
          <WoodSign style={styles.sign}>
            <View style={styles.row}>
              <View style={styles.offer}>
                {offered === undefined ? null : (
                  <View
                    accessible
                    accessibilityLabel={texts['play.sort.offer']}
                    style={styles.face}
                  >
                    <View style={{ width: this.preview.inner, height: this.preview.inner }}>
                      <StackStone colors={offered.colors} shape={this.preview} />
                    </View>
                  </View>
                )}
                <Text accessibilityLiveRegion="polite" style={styles.hint}>
                  {texts[offered === undefined ? 'play.sort.hint.empty' : 'play.sort.hint.place']}
                </Text>
              </View>
              <View accessible accessibilityLiveRegion="polite" style={styles.goals}>
                <Text style={styles.label}>{texts['play.sort.goals']}</Text>
                <Text style={styles.progress}>
                  {`${payload.goalsDone} / ${payload.goalsNeeded}`}
                </Text>
              </View>
            </View>
          </WoodSign>
        )}
      </>
    );
  }
}

const styles = StyleSheet.create({
  sign: { alignSelf: 'stretch', marginTop: space.lg },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  offer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  face: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    borderColor: palette.trim,
    borderWidth: 2,
    borderRadius: radius.md,
  },
  hint: { flex: 1, color: palette.ink, fontFamily: serif, fontSize: 14 },
  goals: { alignItems: 'center' },
  label: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progress: { color: palette.ink, fontFamily: serif, fontSize: 22, fontWeight: '700' },
});
