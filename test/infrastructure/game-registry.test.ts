/** @jest-environment node */
import { GameId } from '../../src/domain/engine/game-id';
import { GameRegistry, registered } from '../../src/infrastructure/game-registry';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { variantIdOf } from '../support/variants/variant-id';

// Issue #162: the game registry maps each `GameId` to its game and its variant factory
// (step 10 of docs/EXTENSIBILITY.md). A fifth variant adds one entry.
describe('GameRegistry', () => {
  it('should_give_the_ids_in_the_order_of_registration_when_games_are_registered', () => {
    const registry = new GameRegistry([
      registered(mergeFactory()),
      registered(linesFactory()),
      registered(fitFactory()),
    ]);

    expect(registry.gameIds().map(variantIdOf)).toEqual(['hexa-merge', 'hexa-lines', 'hexa-fit']);
  });

  it('should_give_the_factory_of_the_game_when_its_id_is_registered', () => {
    const merge = mergeFactory();
    const registry = new GameRegistry([registered(linesFactory()), registered(merge)]);

    const found = registry
      .gameOf(GameId.of('hexa-merge'))
      .withFactory({ use: (factory) => Object.is(factory, merge) });

    expect(found).toBe(true);
  });

  it('should_throw_a_range_error_when_the_id_is_not_registered', () => {
    const registry = new GameRegistry([registered(linesFactory())]);

    expect(() => registry.gameOf(GameId.of('hexa-fill'))).toThrow(
      new RangeError('The registry holds no game with this id.'),
    );
  });

  it('should_throw_a_range_error_when_two_games_have_one_game_id', () => {
    expect(
      () =>
        new GameRegistry([
          registered(linesFactory()),
          registered(mergeFactory()),
          registered(linesFactory(2)),
        ]),
    ).toThrow(new RangeError('The registry holds two games with one id.'));
  });
});
