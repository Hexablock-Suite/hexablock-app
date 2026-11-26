import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GamePresenter, GameViewModel } from '../../adapters/game-presenter';
import type { Texts } from '../../adapters/texts/text-catalog';
import type { LevelId } from '../../domain/engine/level-id';
import { fittedCellSize } from '../board/board-fit';
import type { BoardLayout } from '../board/board-layout';
import { BoardView } from '../board/board-view';
import type { CellRenderer } from '../board/cell-renderer';
import type { MoveControls } from './move-controls';
import { Scenery } from './scenery';
import { column, CONTENT_WIDTH, lip, palette, radius, serif, shadow, space } from './theme';
import { LipButton, WoodSign } from './wood';

// The largest cell of the board. A cell of 48 is wide enough for a finger.
const LARGEST_CELL = 48;
// The wood frame of the board and the dark face inside it.
const FRAME = 6;
const FACE = space.md;
// The width that the board loses to the frame and the face.
const FRAME_GUTTER = 2 * (FRAME + FACE);

// The width that the board takes in a window of the width `width` (#319). The content column
// fills the window less the side padding of the screen, up to `CONTENT_WIDTH` (#287).
// The frame and the face sit inside that column.
function boardWidthIn(width: number): number {
  return Math.min(width - 2 * space.lg, CONTENT_WIDTH) - FRAME_GUTTER;
}

export interface GameStageProps<TCellView> {
  // The name of the game, as the game selector shows it.
  readonly title: string;
  readonly presenter: GamePresenter<unknown, unknown, unknown, unknown, TCellView, unknown>;
  // The cell renderer, the move controls and the figure layout that the registry chooses
  // for the game.
  readonly renderer: CellRenderer<TCellView>;
  readonly controls: MoveControls<unknown, TCellView, unknown, unknown>;
  readonly layoutOf: (size: number) => BoardLayout<unknown>;
  // The texts of the language of the screen, for the move controls (#175).
  readonly texts: Texts;
  // Goes back to the game selector map.
  readonly onBack: () => void;
  // The level that the player chose on the level selector (#173). A game with no levels,
  // or a route that names no level, starts with none.
  readonly levelId?: LevelId;
}

// The stage of the game screen, the MVP view of `GamePresenter` (issue #170, S3-07 in #151,
// a proposal that waits for the team). `GameScreen`, the game route, renders it with the session
// of its game. It keeps the presenter, the cell renderer and the figure layout that it receives.
// It starts the game when it opens, with the level of `levelId` when the route names one (#173),
// and it shows each view model that the presenter gives:
// `BoardView` with every space of the board, the score, the time of a timed game (#175)
// and the outcome. The board takes the widest cell size that fits the content column.
// A failed use case shows its text below the board. It names no variant, so it serves every game.
// The move controls of the game lay out the board with their own parts (#175): the stage gives
// them the view model, the board and `play()`, which calls `GamePresenter.onMove()`.
// It also gives them `undo()` and `redo()`, which call `GamePresenter.onUndo()` and `onRedo()`
// (#178). So the undo path of the stage names no variant, and each game shows its own buttons.
// Every visible text comes from the presenter or from the texts that the controls get,
// and both read the text catalog (APP-FR-11).
export function GameStage<TCellView>({
  title,
  presenter,
  renderer,
  controls,
  layoutOf,
  texts,
  onBack,
  levelId,
}: GameStageProps<TCellView>) {
  const view = useGameViewModel(presenter, levelId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const coords = view.cells.map(([at]) => at);
  const size = fittedCellSize(coords, layoutOf, boardWidthIn(width), LARGEST_CELL);
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <StatusBar style="dark" />
      <Scenery />
      <View style={styles.column}>
        <View style={styles.top}>
          <LipButton label={view.back} look="panel" onPress={onBack} />
        </View>
        <WoodSign style={styles.titleSign}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </WoodSign>
        <WoodSign style={styles.statusSign}>
          <View style={styles.status}>
            <View accessible style={styles.score}>
              <Text style={styles.scoreLabel}>{view.scoreLabel}</Text>
              <Text style={styles.scoreValue}>{view.score}</Text>
            </View>
            {view.time === undefined ? null : (
              <View accessible testID="play-time" style={styles.score}>
                <Text style={styles.scoreLabel}>{view.time.label}</Text>
                <Text style={styles.scoreValue}>{view.time.value}</Text>
              </View>
            )}
            <Text accessibilityLiveRegion="polite" style={styles.outcome}>
              {view.outcome}
            </Text>
          </View>
        </WoodSign>
        {controls.render({
          model: view,
          texts,
          layoutOf,
          play: (move) => void presenter.onMove(move),
          undo: () => void presenter.onUndo(),
          redo: () => void presenter.onRedo(),
          board: (onPressSpace) => (
            <View style={styles.boardArea}>
              <View style={styles.frame}>
                <View style={styles.face}>
                  <BoardView
                    cells={view.cells}
                    layout={layoutOf(size)}
                    renderer={renderer}
                    label={view.board}
                    onPressSpace={onPressSpace}
                  />
                </View>
              </View>
            </View>
          ),
        })}
        {view.error === undefined ? null : (
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={styles.error}
          >
            <Text style={styles.errorText}>{view.error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// The view model that the presenter shows last. The screen attaches as the view of
// the presenter and starts the game, at the level `levelId` when it has one.
// It detaches when it closes.
function useGameViewModel<TCellView>(
  presenter: GamePresenter<unknown, unknown, unknown, unknown, TCellView, unknown>,
  levelId: LevelId | undefined,
): GameViewModel<unknown, TCellView, unknown> {
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onStart(levelId);
    return () => presenter.detach();
  }, [presenter, levelId]);
  return model;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: space.lg,
    backgroundColor: palette.sky,
  },
  // The parts of the stage fill the screen of a phone and stay in the content column
  // on a wide window (#287). The scenery stays outside the column, so it fills the window.
  column: {
    ...column,
    flex: 1,
  },
  top: {
    alignItems: 'flex-start',
  },
  titleSign: {
    alignSelf: 'center',
    marginTop: space.md,
  },
  title: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 26,
    textAlign: 'center',
  },
  statusSign: {
    alignSelf: 'stretch',
    marginTop: space.lg,
  },
  status: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  score: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  scoreLabel: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  scoreValue: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  outcome: {
    flexShrink: 1,
    color: palette.ink,
    fontFamily: serif,
    fontSize: 17,
    textAlign: 'right',
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
  },
  frame: {
    backgroundColor: palette.wood,
    borderRadius: radius.lg,
    padding: FRAME,
    boxShadow: `0 ${lip.md}px 0 ${palette.woodDark}, ${shadow.sign}`,
  },
  face: {
    backgroundColor: palette.woodDark,
    borderRadius: radius.md,
    padding: FACE,
  },
  error: {
    alignSelf: 'stretch',
    backgroundColor: palette.panel,
    borderColor: palette.ribbon,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  errorText: {
    color: palette.ribbonDeep,
    fontFamily: serif,
    fontSize: 16,
    textAlign: 'center',
  },
});
