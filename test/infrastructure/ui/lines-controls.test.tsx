import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GamePresenter } from '../../../src/adapters/game-presenter';
import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { Color } from '../../../src/domain/engine/color';
import { GameId } from '../../../src/domain/shared/game-id';
import { TopologyId } from '../../../src/domain/shared/topology-id';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { CellNode } from '../../../src/domain/engine/shape-node';
import { TriangleGeometry } from '../../../src/domain/engine/triangle-geometry';
import { triangle } from '../../../src/domain/engine/triangle-topology';
import { LinesFactory, LinesSettings } from '../../../src/domain/variants/hexa-lines/lines-factory';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { gameUseCases } from '../../support/application/game-use-cases';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';
import { seededRandom } from '../../support/engine/step-random';
import { occupiedSpaces, pressSpace } from '../../support/ui/board-spaces';
import { linesFactory } from '../../support/variants/hexa-lines/lines-game';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function openGame<TCoord>(figure: TopologyId, factory: LinesFactory<TCoord>): Promise<void> {
  const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });
  const { mapper, moves, controls, renderer, layoutOf } = root
    .registry(figure)
    .gameOf(GameId.of('hexa-lines')).screen;
  const { startGame, applyMove, undoMove, redoMove } = gameUseCases(factory);
  const presenter = new GamePresenter(
    startGame,
    applyMove,
    undoMove,
    redoMove,
    mapper,
    moves,
    textCatalog.es,
  );
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <GameStage
        title="Hexa Lines"
        presenter={presenter}
        renderer={renderer}
        controls={controls}
        layoutOf={layoutOf}
        texts={textCatalog.es}
        onBack={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await screen.findByText('En juego');
}

const tray = () => screen.getAllByRole('radio');

it('should_change_the_board_and_score_when_the_player_places_a_selected_piece', async () => {
  await openGame(TopologyId.square, linesFactory());
  expect(tray()).toHaveLength(3);
  expect(screen.getByText('0')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^(Deshacer|Rehacer)$/ })).toBeNull();

  await pressSpace(0);
  expect(occupiedSpaces()).toEqual([]);

  await fireEvent.press(tray()[0]);
  await pressSpace(0);

  expect(occupiedSpaces()).toEqual([0]);
  expect(screen.getByText('1')).toBeOnTheScreen();
  expect(tray()).toHaveLength(2);
  expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /^(Deshacer|Rehacer)$/ })).toBeNull();
});

it('should_keep_the_selection_on_rejection_and_refill_only_after_the_last_piece_when_playing', async () => {
  await openGame(TopologyId.square, linesFactory());
  await fireEvent.press(tray()[0]);
  await pressSpace(0);
  expect(tray()).toHaveLength(2);

  await fireEvent.press(tray()[0]);
  await pressSpace(0);
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  expect(occupiedSpaces()).toEqual([0]);
  expect(screen.getByText('1')).toBeOnTheScreen();
  expect(tray()).toHaveLength(2);
  expect(screen.getByRole('radio', { checked: true })).toBeOnTheScreen();

  await pressSpace(4);
  expect(occupiedSpaces()).toEqual([0, 4]);
  expect(tray()).toHaveLength(1);
  expect(screen.queryByRole('alert')).toBeNull();

  await fireEvent.press(tray()[0]);
  await pressSpace(5);
  expect(occupiedSpaces()).toEqual([0, 4, 5]);
  expect(tray()).toHaveLength(3);
  expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
});

it('should_place_at_the_paired_up_triangle_when_the_down_triangle_is_tapped', async () => {
  await placeOnTriangle(2);
  expect(occupiedSpaces()).toEqual([5]);
  expect(screen.getByText('1')).toBeOnTheScreen();
  expect(tray()).toHaveLength(2);
});

it('should_place_at_the_up_triangle_when_that_triangle_is_tapped', async () => {
  await placeOnTriangle(5);
  expect(occupiedSpaces()).toEqual([5]);
  expect(screen.getByText('1')).toBeOnTheScreen();
  expect(tray()).toHaveLength(2);
});

async function placeOnTriangle(index: number): Promise<void> {
  const factory = new LinesFactory(
    new TriangleGeometry(),
    LinesSettings.of(RegionSize.of(3), [new CellNode(triangle(0, 0))], [Color.of('red')]),
    seededRandom(1),
  );
  await openGame(TopologyId.triangle, factory);
  await fireEvent.press(tray()[0]);
  // Down triangles have higher hit-box centers. The first row's last pair is 2 and 5.
  await pressSpace(index);
}
