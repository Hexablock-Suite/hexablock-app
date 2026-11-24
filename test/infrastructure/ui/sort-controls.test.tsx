import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GamePresenter } from '../../../src/adapters/game-presenter';
import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { Color } from '../../../src/domain/engine/color';
import { GameId } from '../../../src/domain/engine/game-id';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { ColorStack } from '../../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../src/domain/variants/hexa-sort/sort-level';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { gameUseCases } from '../../support/application/game-use-cases';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';
import { occupiedSpaces, pressSpace, spaces } from '../../support/ui/board-spaces';
import { outlinesIn } from '../../support/ui/cell-outlines';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function openLevel(stacks: readonly (readonly string[])[]): Promise<void> {
  const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });
  const game = root.registry().gameOf(GameId.of('hexa-sort'));
  const { mapper, controls, renderer, layoutOf } = game.screen;
  const level = SortLevel.fixed(
    RegionSize.of(2),
    GoalCount.of(2),
    stacks.map((stack) => ColorStack.of(stack.map(Color.of))),
  );
  const { startGame, applyMove, undoMove, redoMove } = gameUseCases(
    new SortFactory(new HexGeometry(), level),
  );
  const presenter = new GamePresenter(
    startGame,
    applyMove,
    undoMove,
    redoMove,
    mapper,
    textCatalog.es,
  );
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <GameStage
        title="Hexa Sort"
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

const currentOffer = () => screen.getByLabelText('Pila disponible');

describe('SortControls', () => {
  it('should_draw_the_offered_stack_on_the_board_and_present_the_next_offer_when_a_free_space_is_pressed', async () => {
    await openLevel([['red', 'blue', 'red'], ['green']]);
    const offered = outlinesIn(currentOffer());
    expect(offered).toHaveLength(6);
    expect(spaces()).toHaveLength(7);

    await pressSpace(0);

    expect(occupiedSpaces()).toEqual([0]);
    expect(outlinesIn(spaces()[0])).toEqual(offered);
    expect(outlinesIn(currentOffer())).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^(Deshacer|Rehacer)$/ })).toBeNull();

    await pressSpace(0);

    expect(outlinesIn(currentOffer())).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should_show_progress_and_allow_placement_again_when_a_goal_clears_two_spaces', async () => {
    const redRun = Array<string>(5).fill('red');
    await openLevel([redRun, redRun, ['green']]);
    expect(screen.getByText('0 / 2')).toBeOnTheScreen();

    await pressSpace(0);
    await pressSpace(1);

    expect(screen.getByText('1 / 2')).toBeOnTheScreen();
    expect(occupiedSpaces()).toEqual([]);

    await pressSpace(0);

    expect(occupiedSpaces()).toEqual([0]);
    expect(screen.queryByLabelText('Pila disponible')).toBeNull();

    await pressSpace(1);

    expect(occupiedSpaces()).toEqual([0]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
