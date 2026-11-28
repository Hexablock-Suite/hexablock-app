import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MoveResult } from '../../../src/application/move-result';
import { GameId } from '../../../src/domain/shared/game-id';
import { HexGeometry } from '../../../src/domain/engine/geometry/hex-geometry';
import type { Score } from '../../../src/domain/shared/score';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import type { GameSession } from '../../../src/infrastructure/ui/screen-services';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { CONTENT_WIDTH, space } from '../../../src/infrastructure/ui/theme';
import { valueOf } from '../../support/application/game-use-cases';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';
import { pressSpace } from '../../support/ui/board-spaces';

// Issue #170: `GameStage`, the view of the game screen, shows the board of a game, its score
// and its outcome, and starts the game when it opens. These tests build the real composition
// root with a manual clock, so each game takes the same seed in every run. The presenter sends each move through
// the `UseCase` port of the root, and the logging aspect of the root records each call.

const FOUR_VARIANTS = ['hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge'];

// A safe area with no insets, as a phone without a notch gives it.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function testRoot(logger = new RecordingLogger()): CompositionRoot {
  return new CompositionRoot({ clock: new ManualClock(), logger });
}

// The origin of the hexagon, the default board figure.
const ORIGIN = new HexGeometry().createCoord([0, 0]);

// The first intent of each game on the hexagon, as its move controls send it (#405): a press
// or a slide that the rules accept on a new board. Lines places its first tray piece on the
// origin, Fit places the single cell `b` of its first level on the origin, Sort places
// the stack of the first tray slot on the origin (#353), and Merge slides east.
const FIRST_INTENTS: Readonly<Record<string, unknown>> = {
  'hexa-lines': { position: 0, at: ORIGIN },
  'hexa-fit': { kind: 'place', piece: 'b', rotation: 0, at: ORIGIN },
  'hexa-sort': { slot: 0, at: ORIGIN },
  'hexa-merge': { toward: 'east' },
};

// The first intent of a new game of the registered game `gameId`.
function firstIntentOf(gameId: GameId): unknown {
  return FIRST_INTENTS[slugOf(gameId)];
}

// The move of the first intent of the registered game `gameId`: the move mapper
// of its registry entry builds it.
function firstMoveIn(root: CompositionRoot, gameId: GameId): unknown {
  return root.registry().gameOf(gameId).screen.moves.toMove(firstIntentOf(gameId));
}

// The number of a score, as the screen shows it.
function textOf(score: Score): string {
  let text = '';
  score.deliverTo({ receive: (value) => (text = String(value)) });
  return text;
}

// The answer of `ApplyMove` to the first move of a new game, from another root with the same
// clock. The registered games take their seeds from the clock, so both roots play one game.
async function referenceMove(gameId: GameId): Promise<MoveResult<unknown, unknown>> {
  const root = testRoot();
  const { startGame, applyMove } = root.gameUseCases(gameId);
  valueOf(await startGame.execute({}));
  return valueOf(await applyMove.execute({ move: firstMoveIn(root, gameId) }));
}

async function show(session: GameSession, onBack = jest.fn()) {
  await render(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <GameStage title="Hexa Fit" {...session} onBack={onBack} />
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
  await screen.findByText('En juego');
}

// The window of the screen. `useWindowDimensions()` reads it, and the stage fits the board to it.
const JEST_WINDOW = Dimensions.get('window');

function setWindowWidth(width: number): void {
  Dimensions.set({ window: { ...JEST_WINDOW, width } });
}

// The text of a game id.
function slugOf(gameId: GameId): string {
  let slug = '';
  gameId.deliverTo({ receive: (value) => (slug = value) });
  return slug;
}

// The rendered width of the board and of its wood frame. The frame width adds the side padding
// of the dark face and of the frame around the board, as the rendered styles give them.
function boardWidths(): { board: number; frame: number } {
  const board = screen.getByLabelText('Tablero');
  const face = board.parent;
  const frame = face?.parent;
  const paddingOf = (style: unknown) => Number(StyleSheet.flatten(style as never)?.padding ?? 0);
  const width = Number(StyleSheet.flatten(board.props.style).width);
  return {
    board: width,
    frame: width + 2 * paddingOf(face?.props.style) + 2 * paddingOf(frame?.props.style),
  };
}

// The margin of a frame of the width `frame` in a window of the width `width`, in hundredths
// of a point, so the rounding of the board width does not count.
const marginOf = (width: number, frame: number) => Math.round(((width - frame) / 2) * 100) / 100;

// The rendered widths of the board of each registered game on each board figure, in a window
// of the width `width`: one row of the figure, the game id, the board width and the frame width.
async function boardsAt(width: number): Promise<[string, string, number, number][]> {
  setWindowWidth(width);
  const rows: [string, string, number, number][] = [];
  const figures = testRoot().figures();
  for (const figure of figures) {
    for (const gameId of testRoot().registry(figure).gameIds()) {
      await render(
        <GestureHandlerRootView>
          <SafeAreaProvider initialMetrics={METRICS}>
            <GameStage
              title="Hexa"
              {...testRoot().gameSession(gameId, figure)}
              onBack={jest.fn()}
            />
          </SafeAreaProvider>
        </GestureHandlerRootView>,
      );
      await screen.findByText('En juego');
      const { board, frame } = boardWidths();
      rows.push([JSON.stringify(figure), slugOf(gameId), board, frame]);
      await screen.unmount();
    }
  }
  return rows;
}

// A rendered host node of the screen.
type HostNode = ReturnType<typeof screen.getByLabelText>;

// The host nodes from `node` up to the root of the screen, `node` first.
function chainOf(node: HostNode | null): HostNode[] {
  return node === null ? [] : [node, ...chainOf(node.parent)];
}

// The flat style of a host node.
const styleOf = (node: HostNode) => StyleSheet.flatten(node.props.style as never) ?? {};

// True when the node takes a share of the free height of its parent.
const grows = (node: HostNode) =>
  Number(styleOf(node).flex ?? 0) > 0 || Number(styleOf(node).flexGrow ?? 0) > 0;

// The board area and the nodes between it and the content column of the stage, area first.
// The column holds the title, so it is the first node above the board that holds the title too.
// The board area is the lowest node above the board that grows into the free height (#490).
// A node with `display: 'contents'`, as the gesture detector renders it, draws no box of its own,
// so the layout skips it, and so does the chain.
function boardAreaChain(title: string): HostNode[] {
  const column = new Set(chainOf(screen.getByRole('header', { name: title })));
  const above = chainOf(screen.getByLabelText('Tablero')).filter(
    (node) => styleOf(node).display !== 'contents',
  );
  const below = above.slice(
    0,
    above.findIndex((node) => column.has(node)),
  );
  const area = below.findIndex(grows);
  return area < 0 ? [] : below.slice(area);
}

// The renderer hides each space from the screen reader, because the board carries the name.
const occupied = () => screen.queryAllByTestId('space-occupied', { includeHiddenElements: true });
const free = () => screen.queryAllByTestId('space-free', { includeHiddenElements: true });

describe('GameStage', () => {
  it('should_start_the_game_and_draw_every_space_of_the_board_when_the_screen_opens', async () => {
    const logger = new RecordingLogger();
    const session = testRoot(logger).gameSession(GameId.of('hexa-fit'));

    await show(session);

    expect(screen.getByRole('header', { name: 'Hexa Fit' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Tablero')).toBeOnTheScreen();
    // The first Fit level has three cells, and no piece covers them yet.
    expect([free().length, occupied().length]).toEqual([3, 0]);
    // The Fit controls show the move count 0 too, so the test reads the score sign.
    expect(screen.getByText('Puntos').parent).toHaveTextContent(/^Puntos\s*0$/);
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
    ]);
  });

  // The check of this task: a UI test starts a game and sends one move through the `UseCase`
  // port. Each of the four variants plays its first move through the real composition root.
  it('should_show_the_board_and_the_score_after_the_move_when_each_variant_plays_one_move', async () => {
    for (const id of FOUR_VARIANTS) {
      const gameId = GameId.of(id);
      const logger = new RecordingLogger();
      const root = testRoot(logger);
      const session = root.gameSession(gameId);
      const expected = await referenceMove(gameId);
      await show(session);

      await act(() => session.presenter.onMove(firstIntentOf(gameId)));

      expect([id, occupied().length, free().length]).toEqual([
        id,
        expected.cells.length,
        expected.freeSpaces.length,
      ]);
      expect(screen.getByText(textOf(expected.score))).toBeOnTheScreen();
      expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
        ['StartGame', 'success'],
        ['ApplyMove', 'success'],
      ]);
      screen.unmount();
    }
  });

  // A Lines piece cannot cover a cell that another piece already covers.
  it('should_keep_the_board_and_show_the_rejected_move_text_when_the_rules_reject_the_move', async () => {
    const root = testRoot();
    const gameId = GameId.of('hexa-lines');
    const session = root.gameSession(gameId);
    const intent = firstIntentOf(gameId);
    await show(session);
    await act(() => session.presenter.onMove(intent));
    const board = [free().length, occupied().length];

    await act(() => session.presenter.onMove(intent));

    expect(screen.getByRole('alert')).toHaveTextContent('Esa jugada no se puede hacer');
    expect([free().length, occupied().length]).toEqual(board);
  });

  // Issue #175: the board takes a press on a space for the move controls of a variant.
  // A game with no move controls of its own plays no move when the player presses a space.
  it('should_play_no_move_when_the_player_presses_a_space_of_a_game_with_no_move_controls', async () => {
    const logger = new RecordingLogger();
    await show(testRoot(logger).gameSession(GameId.of('hexa-lines')));
    const board = [free().length, occupied().length];

    await pressSpace(0);

    expect([free().length, occupied().length]).toEqual(board);
    expect(logger.entries.map((entry) => entry.useCase)).toEqual(['StartGame']);
  });

  // Issue #178 (APP-FR-08): Lines and Sort show no undo. The move controls of a game choose
  // its buttons: the Fit controls show the undo and the redo, and since #179 the Merge controls
  // show the undo only, because Merge never redoes.
  it('should_show_the_undo_on_the_fit_and_merge_screens_and_the_redo_only_on_the_fit_screen_when_each_game_opens', async () => {
    const shown: [string, number, number][] = [];
    for (const id of FOUR_VARIANTS) {
      await show(testRoot().gameSession(GameId.of(id)));
      shown.push([
        id,
        screen.queryAllByRole('button', { name: 'Deshacer' }).length,
        screen.queryAllByRole('button', { name: 'Rehacer' }).length,
      ]);
      await screen.unmount();
    }

    expect(shown).toEqual([
      ['hexa-lines', 0, 0],
      ['hexa-fit', 1, 1],
      ['hexa-sort', 0, 0],
      ['hexa-merge', 1, 0],
    ]);
  });

  it('should_call_back_when_the_player_presses_the_map_button', async () => {
    const onBack = jest.fn();
    await show(testRoot().gameSession(GameId.of('hexa-merge')), onBack);

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // Issue #319: the board keeps a side margin, and no cell touches the screen edge.
  // The board of Hexa Lines is a hexagon of radius 5, and its middle row holds 9 cells.
  // The frame keeps the 16-point screen padding on each side, so the outer cells of that row
  // lie 16 + 6 + 12 = 34 points from each screen edge.
  describe('board margin', () => {
    afterEach(() => setWindowWidth(JEST_WINDOW.width));

    it('should_keep_the_hexa_lines_frame_16_points_from_each_screen_edge_when_the_window_is_360_375_or_430_wide', async () => {
      const shown: [number, number, number, string][] = [];
      for (const width of [360, 375, 430]) {
        setWindowWidth(width);
        await show(testRoot().gameSession(GameId.of('hexa-lines')));
        const { board, frame } = boardWidths();
        const spaces = free().length + occupied().length;
        shown.push([width, spaces, marginOf(width, frame), (board / 9).toFixed(2)]);
        await screen.unmount();
      }

      // One row for each width: the spaces, the margin of the frame and the cell size.
      expect(shown).toEqual([
        [360, 61, 16, '32.44'],
        [375, 61, 16, '34.11'],
        [430, 61, 16, '40.22'],
      ]);
    });

    it('should_keep_every_frame_at_least_16_points_from_each_screen_edge_when_the_window_is_360_375_or_430_wide', async () => {
      const tooWide: unknown[] = [];
      let boards = 0;
      for (const width of [360, 375, 430]) {
        for (const [figure, game, board, frame] of await boardsAt(width)) {
          boards += 1;
          if (board <= 0 || marginOf(width, frame) < space.lg) tooWide.push([width, figure, game]);
        }
      }

      // The four games on each of the three figures: 12 boards at each width.
      // Since #354 Hexa Fit has a first level on the square and on the triangle too.
      expect([boards, tooWide]).toEqual([36, []]);
    });

    // A wide window, as the web build on a desktop (#287). The content stays in the column
    // of `CONTENT_WIDTH` points, so the frame of the board fits that column too.
    // The cells keep the largest size of 48 points when the board fits at that size.
    it('should_keep_every_frame_inside_the_content_column_when_the_window_is_1280_wide', async () => {
      const rows = await boardsAt(1280);
      const outside = rows.filter(([, , , frame]) => frame > CONTENT_WIDTH);
      const lines = rows
        .filter(([, game]) => game === 'hexa-lines')
        .map(([figure, , board]) => [figure, Math.round(board * 100) / 100]);

      expect(outside).toEqual([]);
      // Hexa Lines on the hexagon is 9 cells of 48 points wide. On the triangle its board
      // is wider than the column at 48 points, so it fills the column less the frame.
      expect(lines).toEqual([
        ['{"name":"hex"}', 432],
        ['{"name":"square"}', 240],
        ['{"name":"triangle"}', CONTENT_WIDTH - 2 * (6 + space.md)],
      ]);
    });
  });
  // Issue #490: on a phone the Merge board covered the title, the score bar and its own
  // slide buttons. The board area grows into the free height of the column, and it centers
  // the board in that height. A wrapper that does not grow gives the area no height,
  // so the board overflows above and below it. The test renderer computes no layout,
  // so the test reads the rule of the layout: every node between the board area and the column
  // grows, and the board area holds no button of the move controls.
  describe('board place', () => {
    it('should_let_the_board_area_fill_the_free_height_below_the_score_bar_and_hold_no_button_when_each_variant_opens', async () => {
      const shown: [string, number, unknown[], number][] = [];
      for (const id of FOUR_VARIANTS) {
        await show(testRoot().gameSession(GameId.of(id)));
        const chain = boardAreaChain('Hexa Fit');
        const stuck = chain.filter((node) => !grows(node)).map(styleOf);
        const buttons = chain.length === 0 ? -1 : within(chain[0]).queryAllByRole('button').length;
        shown.push([id, chain.length, stuck, buttons]);
        await screen.unmount();
      }

      // One row for each variant: the nodes from the board area to the column, the nodes
      // among them that do not grow, and the buttons inside the board area.
      expect(shown.map(([id, length, stuck, buttons]) => [id, length > 0, stuck, buttons])).toEqual(
        FOUR_VARIANTS.map((id) => [id, true, [], 0]),
      );
    });
  });
});
