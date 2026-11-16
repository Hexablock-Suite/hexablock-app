import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import type { MoveResult } from '../../../src/application/move-result';
import { GameId } from '../../../src/domain/engine/game-id';
import type { Score } from '../../../src/domain/engine/score';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import { gameSessionOf, type GameSession } from '../../../src/infrastructure/ui/game-session';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { valueOf } from '../../support/application/game-use-cases';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';
import { firstMoveOf } from '../../support/engine/variant-game';

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

// The first valid move of a new game of the registered game `gameId`.
function firstMoveIn(root: CompositionRoot, gameId: GameId): unknown {
  return root
    .registry()
    .gameOf(gameId)
    .withFactory({ use: (_gameId, factory) => firstMoveOf(factory) });
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
    <SafeAreaProvider initialMetrics={METRICS}>
      <GameStage title="Hexa Fit" {...session} onBack={onBack} />
    </SafeAreaProvider>,
  );
  await screen.findByText('En juego');
}

// The renderer hides each space from the screen reader, because the board carries the name.
const occupied = () => screen.queryAllByTestId('space-occupied', { includeHiddenElements: true });
const free = () => screen.queryAllByTestId('space-free', { includeHiddenElements: true });

describe('GameStage', () => {
  it('should_start_the_game_and_draw_every_space_of_the_board_when_the_screen_opens', async () => {
    const logger = new RecordingLogger();
    const session = gameSessionOf(testRoot(logger), GameId.of('hexa-fit'), textCatalog.es);

    await show(session);

    expect(screen.getByRole('header', { name: 'Hexa Fit' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Tablero')).toBeOnTheScreen();
    // The first Fit level has three cells, and no piece covers them yet.
    expect([free().length, occupied().length]).toEqual([3, 0]);
    expect(screen.getByText('Puntos')).toBeOnTheScreen();
    expect(screen.getByText('0')).toBeOnTheScreen();
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
      const session = gameSessionOf(root, gameId, textCatalog.es);
      const expected = await referenceMove(gameId);
      await show(session);

      await act(() => session.presenter.onMove(firstMoveIn(root, gameId)));

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
    const session = gameSessionOf(root, gameId, textCatalog.es);
    const move = firstMoveIn(root, gameId);
    await show(session);
    await act(() => session.presenter.onMove(move));
    const board = [free().length, occupied().length];

    await act(() => session.presenter.onMove(move));

    expect(screen.getByRole('alert')).toHaveTextContent('Esa jugada no se puede hacer');
    expect([free().length, occupied().length]).toEqual(board);
  });

  it('should_call_back_when_the_player_presses_the_map_button', async () => {
    const onBack = jest.fn();
    await show(gameSessionOf(testRoot(), GameId.of('hexa-merge'), textCatalog.es), onBack);

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
