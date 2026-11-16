import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GamePresenter } from '../../../src/adapters/game-presenter';
import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { GameId } from '../../../src/domain/engine/game-id';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Seed } from '../../../src/domain/engine/seed';
import { MergeFactory, MergeSettings } from '../../../src/domain/variants/hexa-merge/merge-factory';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import { boardFigures, mergeScreen } from '../../../src/infrastructure/registered-games';
import { gameSessionOf, type GameSession } from '../../../src/infrastructure/ui/game-session';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { gameUseCases } from '../../support/application/game-use-cases';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';

// Issue #177: Hexa Merge is playable on the game screen. The registry gives Merge its state
// mapper, its cell renderer and its move controls: one slide button for each way that
// the topology gives, six on the hexagon. When a merge makes the target tile, the screen
// offers to continue, as in 2048 (A3). The prompt reads the target flag of the payload,
// because the rules never answer a victory for Merge.

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
    <SafeAreaProvider initialMetrics={METRICS}>
      <GameStage title="Hexa Merge" {...session} onBack={jest.fn()} />
    </SafeAreaProvider>,
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

const prompt = () => screen.queryByRole('header', { name: '¡Lo lograste!' });

describe('Merge on the game screen', () => {
  // The real composition root with a manual clock, so the game takes the same seed in every run.
  // With that seed, the first two tiles can slide to the east.
  it('should_change_the_board_when_the_player_presses_one_slide_button', async () => {
    const logger = new RecordingLogger();
    const root = new CompositionRoot({ clock: new ManualClock(), logger });
    const session = gameSessionOf(root, GameId.of('hexa-merge'), textCatalog.es);
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

  // A game with the target 4 makes its target with the first merge of two tiles of 2.
  // The screen parts are the parts that the registry gives Merge on the hexagon.
  it('should_offer_to_continue_and_keep_the_game_going_when_a_slide_makes_the_target_tile', async () => {
    const parts = mergeScreen(boardFigures()[0]);
    const factory = new MergeFactory(
      new HexGeometry(),
      MergeSettings.of(RegionSize.of(3), Seed.of(7), MergeTile.of(4)),
    );
    const { startGame, applyMove } = gameUseCases(factory);
    const session: GameSession = {
      presenter: new GamePresenter(startGame, applyMove, parts.mapper, textCatalog.es),
      renderer: parts.renderer,
      layoutOf: (size) => parts.layoutOf(size),
      controls: parts.controlsOf?.(textCatalog.es),
    };
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

  // The other games keep the default screen parts until their own task, so they show
  // no slide button (#170).
  it('should_show_no_slide_button_when_the_game_has_no_move_controls', async () => {
    const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });
    for (const id of ['hexa-lines', 'hexa-fit', 'hexa-sort']) {
      await show(gameSessionOf(root, GameId.of(id), textCatalog.es));

      expect([id, screen.queryAllByRole('button', { name: /^Deslizar/ })]).toEqual([id, []]);
      await screen.unmount();
    }
  });
});
