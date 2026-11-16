import { readFileSync } from 'node:fs';
import path from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FitStateMapper } from '../../../src/adapters/fit-state-mapper';
import { GamePresenter } from '../../../src/adapters/game-presenter';
import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import type { HexCoord } from '../../../src/domain/engine/hex-topology';
import { LevelDefinition } from '../../../src/domain/engine/level-definition';
import { FitFactory } from '../../../src/domain/variants/hexa-fit/fit-factory';
import type { FitLevel } from '../../../src/domain/variants/hexa-fit/fit-level';
import { FitLevelBuilder } from '../../../src/domain/variants/hexa-fit/fit-level-builder';
import { FitCellRenderer } from '../../../src/infrastructure/board/fit-cell-renderer';
import { HexLayout } from '../../../src/infrastructure/board/hex-layout';
import { FitControls } from '../../../src/infrastructure/ui/fit-controls';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { gameUseCases } from '../../support/application/game-use-cases';
import { ManualClock } from '../../support/engine/manual-clock';
import { repoRoot } from '../../support/run-tool';
import { occupiedSpaces, pressSpace } from '../../support/ui/board-spaces';

// Issue #175: the player plays Hexa Fit on the game screen. `GameStage` shows the board with
// `FitCellRenderer`, and `FitControls` show the tray, the rotate button and the move count.
// The player picks a piece of the tray, turns it by the rotation step of the topology, places it
// with a press on a free space and takes a placed piece back with a press on one of its spaces.
// These tests play the bundled level `fit-01` over the real use cases with a manual clock.
// Its figure has two rows of three hexagons. In reading order the spaces are
// 0 (0,0), 1 (1,0), 2 (2,0), 3 (0,1), 4 (1,1) and 5 (2,1). Its pieces are `a` (0,0) (1,0) (0,1),
// `b` (0,0) (1,0) and `c` (0,0). A place move puts the origin of the piece on the pressed space.

// A safe area with no insets, as a phone without a notch gives it.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const geometry = new HexGeometry();

// The bundled Fit level of the file `name`, built as the level repository will build it.
function bundledLevel(name: string): FitLevel<HexCoord> {
  const file = JSON.parse(
    readFileSync(path.join(repoRoot, 'src/adapters/levels/fit', name), 'utf8'),
  ) as { topology: string; section: unknown };
  return LevelDefinition.of(file).buildWith(new FitLevelBuilder(geometry));
}

// Opens the game screen on the level `fit-01` with the screen parts of Fit.
async function openFirstBundledLevel(clock = new ManualClock()): Promise<void> {
  const { startGame, applyMove } = gameUseCases(
    new FitFactory(geometry, bundledLevel('fit-01.json'), clock),
  );
  const presenter = new GamePresenter(
    startGame,
    applyMove,
    new FitStateMapper(geometry.createTopology()),
    textCatalog.es,
  );
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <GameStage
        title="Hexa Fit"
        presenter={presenter}
        renderer={new FitCellRenderer()}
        layoutOf={(size) => new HexLayout(size)}
        controls={new FitControls()}
        texts={textCatalog.es}
        onBack={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await screen.findByText('En juego');
}

const piece = (id: string) => screen.getByRole('radio', { name: `Pieza ${id}` });
const trayPieces = () =>
  screen.queryAllByRole('radio').map((each) => each.props.accessibilityLabel);
const movesText = () => screen.getByTestId('fit-moves');

async function choose(id: string): Promise<void> {
  await fireEvent.press(piece(id));
}

describe('FitControls', () => {
  it('should_cover_the_spaces_of_the_piece_and_count_one_move_when_the_player_places_a_piece_of_a_bundled_level', async () => {
    await openFirstBundledLevel();
    expect(
      screen.getByText('Elige una pieza. Toca una pieza puesta para quitarla.'),
    ).toBeOnTheScreen();
    await choose('a');
    expect(piece('a')).toBeChecked();
    expect(
      screen.getByText('Toca una casilla libre: el punto de la pieza va ahí.'),
    ).toBeOnTheScreen();

    await pressSpace(0);

    expect(occupiedSpaces()).toEqual([0, 1, 3]);
    expect(trayPieces()).toEqual(['Pieza b', 'Pieza c']);
    expect(movesText()).toHaveTextContent(/Movimientos\s*1/);
  });

  it('should_place_the_piece_turned_by_one_step_when_the_player_rotates_it_before_placing', async () => {
    await openFirstBundledLevel();
    const rotate = () => screen.getByRole('button', { name: 'Girar' });
    expect(rotate()).toBeDisabled();
    await choose('b');

    await fireEvent.press(rotate());
    await pressSpace(2);

    // One sixth of a turn moves (1,0) of the domino to (0,1), so it covers (2,0) and (2,1).
    expect(occupiedSpaces()).toEqual([2, 5]);
  });

  it('should_give_the_piece_back_to_the_tray_when_the_player_presses_a_space_of_a_placed_piece', async () => {
    await openFirstBundledLevel();
    await choose('a');
    await pressSpace(0);

    await pressSpace(1);

    expect(occupiedSpaces()).toEqual([]);
    expect(trayPieces()).toEqual(['Pieza a', 'Pieza b', 'Pieza c']);
    expect(movesText()).toHaveTextContent(/Movimientos\s*2/);
  });

  // The piece `a` on (2,0) would cover (3,0), which is not a space of the figure.
  it('should_keep_the_board_and_the_chosen_piece_and_show_the_rejected_move_text_when_the_piece_does_not_fit', async () => {
    await openFirstBundledLevel();
    await choose('a');

    await pressSpace(2);

    expect(screen.getByRole('alert')).toHaveTextContent('Esa jugada no se puede hacer');
    expect(occupiedSpaces()).toEqual([]);
    expect(piece('a')).toBeChecked();
    expect(movesText()).toHaveTextContent(/Movimientos\s*0/);
  });

  // The timer starts on the first move (classes.md decision 19). The screen shows the time
  // that the root gives with each answer, so it reads no clock.
  it('should_show_the_time_of_play_of_the_root_after_each_move_when_the_clock_moves', async () => {
    const clock = new ManualClock();
    await openFirstBundledLevel(clock);
    expect(screen.getByText('Tiempo')).toBeOnTheScreen();
    await choose('c');
    await pressSpace(4);
    const afterFirst = screen.getByTestId('play-time');

    expect(afterFirst).toHaveTextContent(/Tiempo\s*0:00/);
    clock.advance(65_000);
    await choose('a');
    await pressSpace(0);

    expect(screen.getByTestId('play-time')).toHaveTextContent(/Tiempo\s*1:05/);
  });

  // The witness of `fit-01` solves it: `a` with no turn on (0,0), `b` turned once on (2,0)
  // and `c` on (1,1).
  it('should_reach_the_victory_outcome_and_empty_the_tray_when_the_player_covers_the_figure', async () => {
    await openFirstBundledLevel();

    await choose('a');
    await pressSpace(0);
    await choose('b');
    await fireEvent.press(screen.getByRole('button', { name: 'Girar' }));
    await pressSpace(2);
    await choose('c');
    await pressSpace(4);

    expect(await screen.findByText('¡Victoria!')).toBeOnTheScreen();
    expect(occupiedSpaces()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(trayPieces()).toEqual([]);
    expect(screen.getByText('Todas las piezas están en la figura.')).toBeOnTheScreen();
  });
});
