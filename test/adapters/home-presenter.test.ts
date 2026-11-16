/** @jest-environment node */
import { HomePresenter } from '../../src/adapters/home-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import { GameId } from '../../src/domain/engine/game-id';

// Issue #169: `HomePresenter` gives the view models of the home screen and of the game
// selector map. It takes the ids of the registered games and the texts of one language.
// The selector lists the games in the order of the registry, so a fifth variant adds one
// registry entry and its names in the text catalog.

function gameIds(...ids: string[]): GameId[] {
  return ids.map((id) => GameId.of(id));
}

const FOUR_GAMES = gameIds('hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge');

describe('HomePresenter', () => {
  it('should_give_the_home_texts_of_the_language_when_the_home_screen_is_presented', () => {
    expect(new HomePresenter(FOUR_GAMES, textCatalog.es).home()).toEqual({
      title: 'HexaBlock Suite',
      brand: 'HexaBlock',
      suite: 'Suite',
      play: 'Jugar',
    });
    expect(new HomePresenter(FOUR_GAMES, textCatalog.en).home()).toEqual({
      title: 'HexaBlock Suite',
      brand: 'HexaBlock',
      suite: 'Suite',
      play: 'Play',
    });
  });

  it('should_list_each_game_in_the_order_of_the_registry_when_the_selector_is_presented', () => {
    const presenter = new HomePresenter(
      gameIds('hexa-merge', 'hexa-lines', 'hexa-sort', 'hexa-fit'),
      textCatalog.es,
    );

    expect(presenter.gameSelector()).toEqual({
      title: 'Mapa de mundos',
      back: 'Atrás',
      games: [
        { id: 'hexa-merge', name: 'Hexa Merge', place: 'Fuente Fusión' },
        { id: 'hexa-lines', name: 'Hexa Lines', place: 'Estación Línea' },
        { id: 'hexa-sort', name: 'Hexa Sort', place: 'Pilópolis' },
        { id: 'hexa-fit', name: 'Hexa Fit', place: 'La Colmena' },
      ],
    });
  });

  it('should_give_the_english_texts_when_the_selector_is_presented_in_english', () => {
    expect(new HomePresenter(FOUR_GAMES, textCatalog.en).gameSelector()).toEqual({
      title: 'World map',
      back: 'Back',
      games: [
        { id: 'hexa-lines', name: 'Hexa Lines', place: 'Line Station' },
        { id: 'hexa-fit', name: 'Hexa Fit', place: 'The Hive' },
        { id: 'hexa-sort', name: 'Hexa Sort', place: 'Stackville' },
        { id: 'hexa-merge', name: 'Hexa Merge', place: 'Merge Fountain' },
      ],
    });
  });

  it('should_list_a_fifth_game_when_the_registry_holds_it_and_the_catalog_names_it', () => {
    const texts = {
      ...textCatalog.es,
      'game.hexa-fill.name': 'Hexa Fill',
      'game.hexa-fill.place': 'Isla Pintura',
    };
    const presenter = new HomePresenter([...FOUR_GAMES, GameId.of('hexa-fill')], texts);

    expect(presenter.gameSelector().games.map((game) => game.id)).toEqual([
      'hexa-lines',
      'hexa-fit',
      'hexa-sort',
      'hexa-merge',
      'hexa-fill',
    ]);
    expect(presenter.gameSelector().games[4]).toEqual({
      id: 'hexa-fill',
      name: 'Hexa Fill',
      place: 'Isla Pintura',
    });
  });

  it('should_throw_a_range_error_when_the_catalog_names_no_game_with_the_id', () => {
    const presenter = new HomePresenter([GameId.of('hexa-fill')], textCatalog.es);

    expect(() => presenter.gameSelector()).toThrow(
      new RangeError('The text catalog names no game with this id.'),
    );
  });

  it('should_throw_a_range_error_when_the_catalog_lacks_the_place_of_a_game', () => {
    const texts = { ...textCatalog.es, 'game.hexa-fill.name': 'Hexa Fill' };
    const presenter = new HomePresenter([GameId.of('hexa-fill')], texts);

    expect(() => presenter.gameSelector()).toThrow(
      new RangeError('The text catalog has no text for the key "game.hexa-fill.place".'),
    );
  });
});
