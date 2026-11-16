import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GamePresenter, GameViewModel } from '../../adapters/game-presenter';
import { fittedCellSize } from '../board/board-fit';
import type { BoardLayout } from '../board/board-layout';
import { BoardView } from '../board/board-view';
import type { CellRenderer } from '../board/cell-renderer';
import type { MoveControls } from './move-controls';
import { Scenery } from './scenery';
import { lip, palette, radius, serif, shadow, space } from './theme';
import { LipButton, WoodSign } from './wood';

// The largest cell of the board. A cell of 48 is wide enough for a finger.
const LARGEST_CELL = 48;
// The wood frame of the board and the dark face inside it.
const FRAME = 6;
const FACE = space.md;
// The width that the board loses to the side of the screen, the frame and the face.
const BOARD_GUTTER = 2 * (space.lg + FRAME + FACE);

export interface GameStageProps<TCellView> {
  // The name of the game, as the game selector shows it.
  readonly title: string;
  readonly presenter: GamePresenter<unknown, unknown, unknown, unknown, TCellView, unknown>;
  // The cell renderer and the figure layout that the registry chooses for the game.
  readonly renderer: CellRenderer<TCellView>;
  readonly layoutOf: (size: number) => BoardLayout<unknown>;
  // The move controls that the registry chooses for the game, if it has them (#177).
  readonly controls?: MoveControls<unknown, unknown>;
  // Goes back to the game selector map.
  readonly onBack: () => void;
}

// The stage of the game screen, the MVP view of `GamePresenter` (issue #170, S3-07 in #151,
// a proposal that waits for the team). `GameScreen`, the game route, renders it with the session
// of its game. It keeps the presenter, the cell renderer and the figure layout that it receives.
// It starts the game when it opens, and it shows each view model that the presenter gives:
// `BoardView` with every space of the board, the score and the outcome. The board takes the
// widest cell size that fits the screen. A failed use case shows its text below the board.
// It names no variant, so it serves every game. Every visible text comes from the presenter,
// which reads the text catalog (APP-FR-11). The move controls of the game, if the registry
// gives them, show below the board with the payload view of the last view model, and they call
// `GamePresenter.onMove()` (#177). Their texts come from the catalog too.
export function GameStage<TCellView>({
  title,
  presenter,
  renderer,
  layoutOf,
  controls,
  onBack,
}: GameStageProps<TCellView>) {
  const view = useGameViewModel(presenter);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const coords = view.cells.map(([at]) => at);
  const size = fittedCellSize(coords, layoutOf, width - BOARD_GUTTER, LARGEST_CELL);
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <StatusBar style="dark" />
      <Scenery />
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
          <Text accessibilityLiveRegion="polite" style={styles.outcome}>
            {view.outcome}
          </Text>
        </View>
      </WoodSign>
      <View style={styles.boardArea}>
        <View style={styles.frame}>
          <View style={styles.face}>
            <BoardView
              cells={view.cells}
              layout={layoutOf(size)}
              renderer={renderer}
              label={view.board}
            />
          </View>
        </View>
      </View>
      {controls?.render({
        payload: view.payload,
        onMove: (move) => void presenter.onMove(move),
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
  );
}

// The view model that the presenter shows last. The screen attaches as the view of
// the presenter and starts the game. It detaches when it closes.
function useGameViewModel<TCellView>(
  presenter: GamePresenter<unknown, unknown, unknown, unknown, TCellView, unknown>,
): GameViewModel<unknown, TCellView, unknown> {
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onStart();
    return () => presenter.detach();
  }, [presenter]);
  return model;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: space.lg,
    backgroundColor: palette.sky,
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
