/** @jest-environment node */
import { GameId } from '../../src/domain/engine/game-id';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { errorOf, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { ManualClock } from '../support/engine/manual-clock';
import { firstMoveOf } from '../support/engine/variant-game';
import { variantIdOf } from '../support/variants/variant-id';

// Issue #162: the composition root wires the layers in one place. It builds the drivers and
// the adapters, the game use cases of each registered game and the aspects around them.
// The tests build it with a manual clock and a recording logger, and render nothing.

const FOUR_VARIANTS = ['hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge'];

function testRoot(logger = new RecordingLogger()): CompositionRoot {
  return new CompositionRoot({ clock: new ManualClock(), logger });
}

// The first valid move of a new game of the registered game `gameId`.
function firstMoveIn(root: CompositionRoot, gameId: GameId): unknown {
  return root
    .registry()
    .gameOf(gameId)
    .withFactory({ use: (factory) => firstMoveOf(factory) });
}

describe('CompositionRoot', () => {
  it('should_register_the_four_variants_when_the_root_is_built', () => {
    expect(testRoot().registry().gameIds().map(variantIdOf)).toEqual(FOUR_VARIANTS);
  });

  // The first move of a new game of the registered factory is valid in the game that
  // `StartGame` opens: both start from the same factory with the same seed.
  it('should_start_each_game_and_accept_one_move_when_the_use_cases_come_from_the_root', async () => {
    const root = testRoot();
    const played: string[] = [];

    for (const gameId of root.registry().gameIds()) {
      const { startGame, applyMove } = root.gameUseCases(gameId);
      valueOf(await startGame.execute({}));
      const move = firstMoveIn(root, gameId);
      valueOf(await applyMove.execute({ move }));
      played.push(variantIdOf(gameId));
    }

    expect(played).toEqual(FOUR_VARIANTS);
  });

  it('should_log_each_call_when_the_root_wraps_the_use_cases_in_the_logging_aspect', async () => {
    const logger = new RecordingLogger();
    const { startGame, undoMove } = testRoot(logger).gameUseCases(GameId.of('hexa-lines'));

    await startGame.execute({});
    await undoMove.execute({});

    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['StartGame', 'success'],
      ['UndoMove', 'failure'],
    ]);
  });

  it('should_give_the_same_use_cases_when_the_root_is_asked_twice_for_one_game', () => {
    const root = testRoot();

    expect(
      root.gameUseCases(GameId.of('hexa-fit')) === root.gameUseCases(GameId.of('hexa-fit')),
    ).toBe(true);
  });

  it('should_answer_no_running_game_when_only_another_game_has_started', async () => {
    const root = testRoot();
    await root.gameUseCases(GameId.of('hexa-merge')).startGame.execute({});

    const move = firstMoveIn(root, GameId.of('hexa-lines'));
    const result = await root.gameUseCases(GameId.of('hexa-lines')).applyMove.execute({ move });

    expect(errorOf(result).code).toBe('no-running-game');
  });

  it('should_throw_a_range_error_when_the_game_is_not_registered', () => {
    expect(() => testRoot().gameUseCases(GameId.of('hexa-fill'))).toThrow(
      new RangeError('The registry holds no game with this id.'),
    );
  });

  it('should_write_each_call_to_the_console_when_the_root_takes_no_driver', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await new CompositionRoot().gameUseCases(GameId.of('hexa-lines')).startGame.execute({});

    expect(info).toHaveBeenCalledWith('StartGame: success');
    info.mockRestore();
  });
});
