/** @jest-environment node */
import { SpaceStateMapper } from '../../src/adapters/space-state-mapper';
import { GameId } from '../../src/domain/engine/game-id';
import { HexLayout } from '../../src/infrastructure/board/hex-layout';
import { GameRegistry, registered, type ScreenParts } from '../../src/infrastructure/game-registry';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { variantIdOf } from '../support/variants/variant-id';

// The screen parts of a game in these tests: the default mapper, a renderer that draws
// nothing and the hexagon layout. A node test renders no component.
function screenParts(): ScreenParts<unknown, unknown, unknown, unknown, undefined> {
  return {
    mapper: new SpaceStateMapper(),
    renderer: { render: () => null },
    layoutOf: (size) => new HexLayout(size),
  };
}

// Issue #162: the game registry maps each `GameId` to its game and its variant factory
// (step 10 of docs/EXTENSIBILITY.md). A fifth variant adds one entry.
// Issue #170: each entry also holds the screen parts of its game.
describe('GameRegistry', () => {
  it('should_give_the_ids_in_the_order_of_registration_when_games_are_registered', () => {
    const registry = new GameRegistry([
      registered(GameId.of('hexa-merge'), mergeFactory(), screenParts()),
      registered(GameId.of('hexa-lines'), linesFactory(), screenParts()),
      registered(GameId.of('hexa-fit'), fitFactory(), screenParts()),
    ]);

    expect(registry.gameIds().map(variantIdOf)).toEqual(['hexa-merge', 'hexa-lines', 'hexa-fit']);
  });

  it('should_give_the_factory_of_the_game_when_its_id_is_registered', () => {
    const merge = mergeFactory();
    const registry = new GameRegistry([
      registered(GameId.of('hexa-lines'), linesFactory(), screenParts()),
      registered(GameId.of('hexa-merge'), merge, screenParts()),
    ]);

    const found = registry
      .gameOf(GameId.of('hexa-merge'))
      .withFactory({ use: (_gameId, factory) => Object.is(factory, merge) });

    expect(found).toBe(true);
  });

  it('should_give_the_screen_parts_of_the_game_when_its_id_is_registered', () => {
    const lines = screenParts();
    const merge = screenParts();
    const registry = new GameRegistry([
      registered(GameId.of('hexa-lines'), linesFactory(), lines),
      registered(GameId.of('hexa-merge'), mergeFactory(), merge),
    ]);

    expect(registry.gameOf(GameId.of('hexa-merge')).screen === merge).toBe(true);
    expect(registry.gameOf(GameId.of('hexa-lines')).screen === lines).toBe(true);
  });

  it('should_throw_a_range_error_when_the_id_is_not_registered', () => {
    const registry = new GameRegistry([
      registered(GameId.of('hexa-lines'), linesFactory(), screenParts()),
    ]);

    expect(() => registry.gameOf(GameId.of('hexa-fill'))).toThrow(
      new RangeError('The registry holds no game with this id.'),
    );
  });

  // Issue #234: the factory keeps its id private, so the entry pairs the id with the factory
  // in one place and asks the factory with `isFor()`.
  it('should_throw_a_range_error_when_the_factory_does_not_build_the_game_of_the_id', () => {
    expect(() => registered(GameId.of('hexa-fit'), linesFactory(), screenParts())).toThrow(
      new RangeError('The factory does not build the game of this id.'),
    );
  });

  it('should_throw_a_range_error_when_two_games_have_one_game_id', () => {
    expect(
      () =>
        new GameRegistry([
          registered(GameId.of('hexa-lines'), linesFactory(), screenParts()),
          registered(GameId.of('hexa-merge'), mergeFactory(), screenParts()),
          registered(GameId.of('hexa-lines'), linesFactory(2), screenParts()),
        ]),
    ).toThrow(new RangeError('The registry holds two games with one id.'));
  });
});
