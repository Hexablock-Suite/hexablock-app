import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GamePresenter } from '../../../src/adapters/game-presenter';
import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { GameId } from '../../../src/domain/shared/game-id';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { MergeFactory, MergeSettings } from '../../../src/domain/variants/hexa-merge/merge-factory';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import type { GameSession } from '../../../src/infrastructure/ui/screen-services';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { gameUseCases } from '../../support/application/game-use-cases';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';
import { seededRandom } from '../../support/engine/step-random';

// Issue #177: Hexa Merge is playable on the game screen. The registry gives Merge its state
// mapper, its cell renderer and its move controls, the `MoveControls` of #175: the board
// and one slide button for each way that the topology gives, six on the hexagon.
// When a merge makes the target tile, the screen offers to continue, as in 2048 (A3).
// The prompt reads the target flag of the payload, because the rules never answer a victory
// for Merge. Since #179 an undo button below the slide buttons takes back the last slide.

// A safe area with no insets, as a phone without a notch gives it.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// The six slide buttons of the hexagon, clockwise from the north-east.
const SIX_SLIDES = [
  'Deslizar al noreste',
  'Deslizar al este',
  'Deslizar al sureste',
  'Deslizar al suroeste',
  'Deslizar al oeste',
  'Deslizar al noroeste',
];

// The count of presses after which a game with the target 4 must have made it.
const MOST_PRESSES = 30;

async function show(session: GameSession): Promise<void> {
  await render(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <GameStage title="Hexa Merge" {...session} onBack={jest.fn()} />
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
  await screen.findByText('En juego');
}

// The picture of the board: the place of each tile and its number, in a fixed order.
// The renderer hides each space from the screen reader, because the board carries the name.
function boardPicture(): string[] {
  return screen
    .queryAllByTestId('space-occupied', { includeHiddenElements: true })
    .map((tile) => {
      const box = StyleSheet.flatten(tile.parent?.props.style) ?? {};
      const number = within(tile).getByText(/^\d+$/, { includeHiddenElements: true });
      return `${box.left},${box.top}=${number.props.children}`;
    })
    .sort();
}

// Presses the slide button `name` and waits for the answer of the presenter.
async function slide(session: GameSession, name: string): Promise<void> {
  const before = session.presenter.viewModel();
  await fireEvent.press(screen.getByRole('button', { name }));
  await waitFor(() => expect(session.presenter.viewModel()).not.toBe(before));
}

// Presses the slide buttons in turn until `done` is true, at most `MOST_PRESSES` times.
// It gives the count of presses, or `MOST_PRESSES + 1` when `done` never turns true.
async function slideUntil(session: GameSession, done: () => boolean): Promise<number> {
  for (let press = 0; press < MOST_PRESSES; press += 1) {
    if (done()) return press;
    await slide(session, SIX_SLIDES[press % SIX_SLIDES.length]);
  }
  return done() ? MOST_PRESSES : MOST_PRESSES + 1;
}

// Presses the undo button and waits for the answer of the presenter.
async function undo(session: GameSession): Promise<void> {
  const before = session.presenter.viewModel();
  await fireEvent.press(undoButton());
  await waitFor(() => expect(session.presenter.viewModel()).not.toBe(before));
}

// The Merge session of the real composition root with a manual clock, so the game takes
// the same seed in every run. With that seed, the first two tiles can slide to the east.
function realMergeSession(logger: RecordingLogger): GameSession {
  const root = new CompositionRoot({ clock: new ManualClock(), logger });
  return root.gameSession(GameId.of('hexa-merge'));
}

// The real root plays to 2048, which no test reaches. So this session plays a game with
// the target 4, which makes its target with the first merge of two tiles of 2.
// The screen parts are the parts that the registry of the real root gives Merge on the hexagon.
function targetFourSession(): GameSession {
  const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });
  const parts = root.registry().gameOf(GameId.of('hexa-merge')).screen;
  const factory = new MergeFactory(
    new HexGeometry(),
    MergeSettings.of(RegionSize.of(3), MergeTile.of(4)),
    seededRandom(7),
  );
  const { startGame, applyMove, undoMove, redoMove } = gameUseCases(factory);
  return {
    presenter: new GamePresenter(
      startGame,
      applyMove,
      undoMove,
      redoMove,
      parts.mapper,
      parts.moves,
      textCatalog.es,
    ),
    renderer: parts.renderer,
    controls: parts.controls,
    layoutOf: (size) => parts.layoutOf(size),
    texts: textCatalog.es,
  };
}

// The picture of the ring of slide buttons in a new Merge screen: the hub, each button and
// its chevron, with their styles. A new root computes the ways of the slides again.
async function ringPicture(): Promise<string> {
  await show(realMergeSession(new RecordingLogger()));
  const ring = screen.getByRole('button', { name: SIX_SLIDES[0] }).parent;
  const picture = JSON.stringify(stylesOf(ring));
  await screen.unmount();
  return picture;
}

interface StyledNode {
  readonly props: { readonly style?: unknown };
  readonly children: readonly (StyledNode | string)[];
}

// The flat style of `node` and of each node below it, in the order of the tree.
function stylesOf(node: StyledNode | null): unknown[] {
  if (node === null) return [];
  return [
    StyleSheet.flatten(node.props.style as never) ?? {},
    ...node.children.flatMap((child) => (typeof child === 'string' ? [] : stylesOf(child))),
  ];
}

const prompt = () => screen.queryByRole('header', { name: '¡Lo lograste!' });
const undoButton = () => screen.getByRole('button', { name: 'Deshacer' });
const scoreOf = (session: GameSession) => session.presenter.viewModel().score;

describe('Merge on the game screen', () => {
  it('should_change_the_board_when_the_player_presses_one_slide_button', async () => {
    const logger = new RecordingLogger();
    const session = realMergeSession(logger);
    await show(session);
    const before = boardPicture();

    await slide(session, 'Deslizar al este');

    expect(screen.getAllByRole('button', { name: /^Deslizar al / })).toHaveLength(6);
    expect(before).toHaveLength(2);
    expect(boardPicture()).not.toEqual(before);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
      ['ApplyMove', 'success'],
    ]);
  });

  it('should_offer_to_continue_and_keep_the_game_going_when_a_slide_makes_the_target_tile', async () => {
    const session = targetFourSession();
    await show(session);
    expect(prompt()).toBeNull();

    const presses = await slideUntil(session, () => prompt() !== null);

    expect(presses).toBeLessThanOrEqual(MOST_PRESSES);
    expect(
      screen.getByText('Formaste la ficha objetivo. Sigue jugando para sumar más puntos.'),
    ).toBeOnTheScreen();
    // The target is an event, not the end of the game (A3).
    expect(screen.getByText('En juego')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Seguir jugando' }));

    expect(prompt()).toBeNull();
    const board = boardPicture();
    const more = await slideUntil(session, () => boardPicture().join() !== board.join());
    expect(more).toBeLessThanOrEqual(MOST_PRESSES);
    // The flag of the payload stays true, and the prompt does not come back.
    expect(prompt()).toBeNull();
    expect(screen.getByText('En juego')).toBeOnTheScreen();
  });

  // Issue #179 (APP-FR-08, S3-15 in #151, «Propuesta, pendiente del equipo»): the undo button
  // gives back the board and the score before the slide. The photo before the slide holds
  // the tile source at its position, so the same slide draws the same new tile again.
  // Merge never redoes, so the screen shows no redo button.
  it('should_give_back_the_board_and_draw_the_same_new_tile_again_when_the_player_undoes_a_slide_and_slides_the_same_way', async () => {
    const logger = new RecordingLogger();
    const session = realMergeSession(logger);
    await show(session);
    const start = boardPicture();
    expect(undoButton()).toBeDisabled();

    await slide(session, 'Deslizar al este');
    const played = boardPicture();
    const playedScore = scoreOf(session);
    expect(undoButton()).toBeEnabled();
    await undo(session);
    const undone = boardPicture();
    const undoneScore = scoreOf(session);
    expect(undoButton()).toBeDisabled();
    await slide(session, 'Deslizar al este');

    expect(played).not.toEqual(start);
    expect(undone).toEqual(start);
    expect(undoneScore).toBe(0);
    expect(boardPicture()).toEqual(played);
    expect(scoreOf(session)).toBe(playedScore);
    expect(screen.queryByRole('button', { name: 'Rehacer' })).toBeNull();
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
      ['ApplyMove', 'success'],
      ['UndoMove', 'success'],
      ['ApplyMove', 'success'],
    ]);
  });

  // Issue #179, the check of APP-FR-08 for Merge: the history keeps one move. So after two
  // slides and one undo, the undo button takes no press, and a second undo changes nothing.
  it('should_change_nothing_when_the_player_presses_undo_a_second_time_in_a_row', async () => {
    const logger = new RecordingLogger();
    const session = realMergeSession(logger);
    await show(session);
    await slide(session, 'Deslizar al este');
    const afterFirst = boardPicture();
    await slide(session, 'Deslizar al oeste');
    await undo(session);
    const undone = boardPicture();
    const score = scoreOf(session);

    await fireEvent.press(undoButton());

    expect(undone).toEqual(afterFirst);
    expect(undoButton()).toBeDisabled();
    expect(boardPicture()).toEqual(undone);
    expect(scoreOf(session)).toBe(score);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
      ['ApplyMove', 'success'],
      ['ApplyMove', 'success'],
      ['UndoMove', 'success'],
    ]);
  });

  // Issue #179: an undo can take the target tile back. The target flag of the payload turns
  // false, and the screen forgets that the player continued. The game is then before its first
  // target again, so the prompt opens again when the same slide makes the target again.
  it('should_offer_to_continue_again_when_the_player_undoes_the_slide_that_made_the_target_and_makes_it_again', async () => {
    const session = targetFourSession();
    await show(session);
    const presses = await slideUntil(session, () => prompt() !== null);
    expect(presses).toBeLessThanOrEqual(MOST_PRESSES);
    await fireEvent.press(screen.getByRole('button', { name: 'Seguir jugando' }));
    expect(prompt()).toBeNull();

    await undo(session);
    const afterUndo = session.presenter.viewModel().payload;
    const promptAfterUndo = prompt();
    await slide(session, SIX_SLIDES[(presses - 1) % SIX_SLIDES.length]);

    expect(afterUndo).toEqual({ targetReached: false });
    expect(promptAfterUndo).toBeNull();
    expect(session.presenter.viewModel().payload).toEqual({ targetReached: true });
    expect(prompt()).not.toBeNull();
  });

  // Issue #318: the web server renders the screen in Node, and the browser hydrates it.
  // The language lets each engine round `Math.sin`, `Math.cos` and `Math.atan2` in its own way,
  // so the last bit of a result can differ. The ring of slide buttons must not show that bit,
  // or the style of the server HTML differs from the style of the client.
  // So this test renders the ring twice, the second time with those functions one bit off,
  // and compares the two pictures of the ring.
  it('should_render_the_same_slide_ring_when_the_math_functions_round_the_last_bit_differently', async () => {
    const exact = await ringPicture();
    const offByOneBit = (exactOf: (...args: number[]) => number) => {
      return (...args: number[]) => exactOf(...args) * (1 + Number.EPSILON);
    };
    const { sin, cos, atan2 } = Math;
    jest.spyOn(Math, 'sin').mockImplementation(offByOneBit(sin));
    jest.spyOn(Math, 'cos').mockImplementation(offByOneBit(cos));
    jest.spyOn(Math, 'atan2').mockImplementation(offByOneBit(atan2));

    const rounded = await ringPicture();
    jest.restoreAllMocks();

    expect(exact).toContain('"left":');
    expect(rounded).toEqual(exact);
  });

  // Lines, Fit and Sort have their own controls, `LinesControls`, `FitControls` and
  // `SortControls` (#174 to #176). So no other game shows a slide button.
  it('should_show_no_slide_button_when_another_game_opens', async () => {
    const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });
    for (const id of ['hexa-lines', 'hexa-fit', 'hexa-sort']) {
      await show(root.gameSession(GameId.of(id)));

      expect([id, screen.queryAllByRole('button', { name: /^Deslizar/ })]).toEqual([id, []]);
      await screen.unmount();
    }
  });
});
