import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FitIntent } from '../../adapters/fit-move-mapper';
import type { FitCellView, FitPayloadView, FitTrayPiece } from '../../adapters/fit-state-mapper';
import { fittedCellSize } from '../../adapters/board/board-fit';
import { cellBoxOf, type BoardLayout } from '../../adapters/board/board-layout';
import { BoardView } from '../board/board-view';
import type { CellRenderer } from '../board/cell-renderer';
import { PieceStone } from '../board/fit-cell-renderer';
import type { MoveControls, MoveControlsProps } from './move-controls';
import { lip, palette, radius, serif, space } from './theme';
import { LipButton, WoodSign } from './wood';

type FitProps<TCoord> = MoveControlsProps<
  TCoord,
  FitCellView,
  FitPayloadView<TCoord>,
  FitIntent<TCoord>
>;

// One action of the view model with its label and its state: the undo or the redo (#178).
type GameAction = NonNullable<FitProps<unknown>['model']['undo']>;

// The piece that the player chose in the tray and the rotation step that it shows.
interface Choice {
  readonly piece: string;
  readonly turn: number;
}

// The face of a tray piece, its border and the margin between the border and the drawing
// (#299). The face is wider than 48, the cell size that the board gives a finger.
const FACE = 60;
const FACE_BORDER = 2;
const PREVIEW_MARGIN = 6;
// The largest width and the largest height of the drawing of a tray piece. It is also
// the largest cell, so the drawing of a single cell fills the face too.
const PREVIEW = FACE - 2 * (FACE_BORDER + PREVIEW_MARGIN);

// The two looks of a tray piece, as the two looks of a figure choice: the chosen piece
// is sun-yellow, and each other piece has a white face on the light panel of the sign.
const LOOKS = {
  chosen: { face: palette.sun, lip: palette.sunDeep, border: palette.sun },
  other: { face: palette.white, lip: palette.woodLight, border: palette.trim },
} as const;

// One space of the drawing of a tray piece: the piece, and whether the space is its origin.
interface PreviewSpace {
  readonly piece: string;
  readonly anchor: boolean;
}

// It draws each space in the outline of the figure, as the board does (#296).
const PREVIEW_RENDERER: CellRenderer<PreviewSpace> = {
  render: ({ piece, anchor }, shape) => <PieceStone piece={piece} anchor={anchor} shape={shape} />,
};

// The move controls of Hexa Fit (classes.md decision 14, issue #175). The game registry
// of the composition root chooses them for Fit. Below the board, a wood sign shows what to do
// next, the count of the accepted moves, the tray and the rotate button. Below the tray,
// the undo button and the redo button take a move back and play it again (#178).
// The player picks a piece of the tray, turns it by the rotation step of the topology
// and presses a free space: the origin of the piece goes there. A piece only turns, and it never
// mirrors (C7). A press on a space of a placed piece takes that piece back to the tray.
// Each press sends a `FitIntent` through `GamePresenter.onMove()`: the text id of the piece,
// the rotation step as a number and the pressed space (#405). `FitMoveMapper` of layer 3
// builds the `PlaceFitPiece` or the `RemoveFitPiece`, with the step of the board figure from
// the pressed space to the offset of the move (#365).
// The rules decide: a piece that does not fit gives the rejected move text of the presenter,
// and it stays chosen.
export class FitControls<TCoord> implements MoveControls<
  TCoord,
  FitCellView,
  FitPayloadView<TCoord>,
  FitIntent<TCoord>
> {
  render(props: FitProps<TCoord>): ReactNode {
    return <FitPlay {...props} />;
  }
}

function FitPlay<TCoord>({ model, texts, layoutOf, play, undo, redo, board }: FitProps<TCoord>) {
  const [chosen, setChosen] = useState<Choice | undefined>();
  const tray = model.payload?.tray ?? [];
  const current = tray.find((each) => each.piece === chosen?.piece);
  const turn = chosen?.turn ?? 0;

  // A piece leaves the choice when it leaves the tray.
  // So a placed piece that comes back to the tray is not chosen.
  useEffect(() => {
    if (chosen !== undefined && current === undefined) setChosen(undefined);
  }, [chosen, current]);

  const onPressSpace = (at: TCoord, cell: FitCellView) => {
    if (cell.piece !== undefined) {
      play({ kind: 'remove', piece: cell.piece });
    } else if (current !== undefined) {
      play({ kind: 'place', piece: current.piece, rotation: turn, at });
    }
  };
  const choose = (piece: string) =>
    setChosen(chosen?.piece === piece ? undefined : { piece, turn: 0 });
  const rotate = () => {
    if (current !== undefined) {
      setChosen({ piece: current.piece, turn: (turn + 1) % current.turns.length });
    }
  };

  return (
    <>
      {board(onPressSpace)}
      <WoodSign style={styles.sign}>
        <View style={styles.header}>
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {hintOf(model.payload, current, texts)}
          </Text>
          <View accessible testID="fit-moves" style={styles.moves}>
            <Text style={styles.movesLabel}>{texts['play.fit.moves']}</Text>
            <Text style={styles.movesValue}>{model.payload?.moves ?? 0}</Text>
          </View>
        </View>
        <View style={styles.controls}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={texts['play.fit.tray']}
            style={styles.tray}
          >
            {tray.map((each) => (
              <TrayPiece
                key={each.piece}
                piece={each}
                turn={each === current ? turn : 0}
                checked={each === current}
                label={`${texts['play.fit.piece']} ${each.piece}`}
                layoutOf={layoutOf}
                onPress={() => choose(each.piece)}
              />
            ))}
          </View>
          <LipButton
            label={texts['play.fit.rotate']}
            look="panel"
            disabled={current === undefined}
            onPress={rotate}
          />
        </View>
        <HistoryButtons undo={model.undo} redo={model.redo} onUndo={undo} onRedo={redo} />
      </WoodSign>
    </>
  );
}

// The undo button and the redo button of the view model, side by side (APP-FR-08, #178).
// Each one takes no press while no move can go back or forward. A view model with no undo
// shows no button.
function HistoryButtons({
  undo,
  redo,
  onUndo,
  onRedo,
}: {
  readonly undo: GameAction | undefined;
  readonly redo: GameAction | undefined;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}) {
  if (undo === undefined && redo === undefined) return null;
  return (
    <View style={styles.history}>
      {undo === undefined ? null : (
        <LipButton label={undo.label} look="panel" disabled={!undo.enabled} onPress={onUndo} />
      )}
      {redo === undefined ? null : (
        <LipButton label={redo.label} look="panel" disabled={!redo.enabled} onPress={onRedo} />
      )}
    </View>
  );
}

// What the player does next: pick a piece, place the chosen piece, or nothing,
// because every piece is on the figure.
function hintOf<TCoord>(
  payload: FitPayloadView<TCoord> | undefined,
  current: FitTrayPiece<TCoord> | undefined,
  texts: FitProps<TCoord>['texts'],
): string {
  if (payload !== undefined && payload.tray.length === 0) return texts['play.fit.hint.done'];
  return current === undefined ? texts['play.fit.hint.pick'] : texts['play.fit.hint.place'];
}

// One piece of the tray: a radio with the drawing of the piece at its rotation step.
// The drawing marks the origin of the piece. The layout of the figure gives the center (0, 0)
// to the origin (decision 17), so the drawing finds the origin without a coordinate.
// The drawing is decoration and takes no press: the label names the piece.
function TrayPiece<TCoord>({
  piece,
  turn,
  checked,
  label,
  layoutOf,
  onPress,
}: {
  readonly piece: FitTrayPiece<TCoord>;
  readonly turn: number;
  readonly checked: boolean;
  readonly label: string;
  readonly layoutOf: (size: number) => BoardLayout<TCoord>;
  readonly onPress: () => void;
}) {
  const cells = piece.turns[turn] ?? [];
  const unit = layoutOf(1);
  // `fittedCellSize()` fits only the width. A piece can be higher than wide at a rotation
  // step, so the height of the drawing also limits the cell size.
  const size = Math.min(
    fittedCellSize(cells, layoutOf, PREVIEW, PREVIEW),
    PREVIEW / heightOf(cells, unit),
  );
  const colors = checked ? LOOKS.chosen : LOOKS.other;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.piece}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.lip, { backgroundColor: colors.lip }]} />
          <View
            style={[
              styles.face,
              { backgroundColor: colors.face, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <BoardView
                cells={cells.map((at) => {
                  const center = unit.centerOf(at);
                  const anchor = center.x === 0 && center.y === 0;
                  return [at, { piece: piece.piece, anchor }] as const;
                })}
                layout={layoutOf(size)}
                renderer={PREVIEW_RENDERER}
                label={label}
              />
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

// The height of the drawing of `cells` in the layout `unit` of size 1, in cell sizes:
// from the top of the topmost outline to the bottom of the lowest outline.
// A drawing with no cell has the height 0, so it sets no limit.
function heightOf<TCoord>(cells: readonly TCoord[], unit: BoardLayout<TCoord>): number {
  if (cells.length === 0) return 0;
  const boxes = cells.map((at) => cellBoxOf(unit, at));
  const top = Math.min(...boxes.map(({ origin }) => origin.y));
  const bottom = Math.max(...boxes.map(({ origin, shape }) => origin.y + shape.height));
  return bottom - top;
}

const styles = StyleSheet.create({
  sign: {
    alignSelf: 'stretch',
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  hint: {
    flex: 1,
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 15,
    lineHeight: 20,
  },
  moves: {
    alignItems: 'flex-end',
  },
  movesLabel: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  movesValue: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.sm,
  },
  history: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.md,
    marginTop: space.sm,
  },
  tray: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    minHeight: FACE + lip.sm,
  },
  piece: {
    paddingBottom: lip.sm,
  },
  lip: {
    position: 'absolute',
    top: lip.sm,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.md,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    width: FACE,
    height: FACE,
    borderRadius: radius.md,
    borderWidth: FACE_BORDER,
  },
  pressed: {
    transform: [{ translateY: lip.sm }],
  },
});
