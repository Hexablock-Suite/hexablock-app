import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

// The move controls of Hexa Sort (classes.md decision 14, issues #176 and #353). Below the board,
// a wood sign shows what to do next, the tray of three stacks and the goals.
// A press on a stack of the tray chooses it, and a press on a free space places it:
// the same two-tap input as Hexa Fit. The press on the space sends a `SortIntent` with
// the index of the chosen slot and the space through `GamePresenter.onMove()` (#405),
// and `SortMoveMapper` of layer 3 builds the `PlaceStack`. An empty slot takes no press.
export class SortControls<TCoord> implements MoveControls<
  TCoord,
  SortCellView,
  SortPayloadView,
  SortIntent<TCoord>
> {
  constructor(private readonly preview: CellShape) {}

  render(props: SortProps<TCoord>): ReactNode {
    return <SortPlay {...props} preview={this.preview} />;
  }
}

function SortPlay<TCoord>({
  model,
  texts,
  play,
  board,
  preview,
}: SortProps<TCoord> & { readonly preview: CellShape }) {
  const [choice, choose] = useState<{ tray: SortPayloadView['tray']; slot: number }>();
  const payload = model.payload;
  const tray = payload?.tray;
  // The presenter keeps the tray on rejection and replaces it on success.
  // So a placed stack leaves the choice.
  const selected = choice?.tray === tray ? choice?.slot : undefined;
  const onPressSpace = (at: TCoord, cell: SortCellView) => {
    if (selected !== undefined && cell.colors.length === 0) play({ slot: selected, at });
  };

  return (
    <>
      {board(onPressSpace)}
      {payload === undefined || tray === undefined ? null : (
        <WoodSign style={styles.sign}>
          <View style={styles.row}>
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {texts[hintOf(tray, selected)]}
            </Text>
            <View accessible accessibilityLiveRegion="polite" style={styles.goals}>
              <Text style={styles.label}>{texts['play.sort.goals']}</Text>
              <Text style={styles.progress}>{`${payload.goalsDone} / ${payload.goalsNeeded}`}</Text>
            </View>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={texts['play.sort.tray']}
            style={styles.tray}
          >
            {tray.map((slot, index) => {
              const label = `${texts['play.sort.stack']} ${index + 1}`;
              const empty = slot.colors.length === 0;
              const checked = index === selected;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked, disabled: empty }}
                  disabled={empty}
                  onPress={() => choose(checked ? undefined : { tray, slot: index })}
                  style={[styles.face, checked && styles.selected]}
                >
                  {empty ? null : (
                    <View style={{ width: preview.inner, height: preview.inner }}>
                      <StackStone colors={slot.colors} shape={preview} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </WoodSign>
      )}
    </>
  );
}

// What the player does next: choose a stack, place the chosen stack, or nothing,
// because the tray is empty and the source has ended.
function hintOf(
  tray: SortPayloadView['tray'],
  selected: number | undefined,
): 'play.sort.hint.empty' | 'play.sort.hint.pick' | 'play.sort.hint.place' {
  if (tray.every((slot) => slot.colors.length === 0)) return 'play.sort.hint.empty';
  return selected === undefined ? 'play.sort.hint.pick' : 'play.sort.hint.place';
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
  tray: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.sm },
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
  selected: { backgroundColor: palette.sun, borderColor: palette.sunDeep },
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
