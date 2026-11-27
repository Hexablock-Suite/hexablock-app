/** @jest-environment node */
import { HomePresenter } from '../../src/adapters/home-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';

// Issue #169: `HomePresenter` gives the view models of the home screen and of the game
// selector map. It takes the ids of the registered games, the board figures of the root
// (#171) and the texts of one language.
// The selector lists the games in the order of the registry, so a fifth variant adds one
// registry entry and its names in the text catalog.

function gameIds(...ids: string[]): GameId[] {
  return ids.map((id) => GameId.of(id));
}

const FOUR_GAMES = gameIds('hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge');

// The three board figures of the root, in the order of the figure selector (#171).
const THREE_FIGURES = [TopologyId.hex, TopologyId.square, TopologyId.triangle];

describe('HomePresenter', () => {
  it('should_give_the_home_texts_of_the_language_when_the_home_screen_is_presented', () => {
    expect(new HomePresenter(FOUR_GAMES, THREE_FIGURES, textCatalog.es).home()).toEqual({
      title: 'HexaBlock Suite',
      brand: 'HexaBlock',
      suite: 'Suite',
      play: 'Jugar',
      achievements: 'Logros',
      figure: 'Figura del tablero',
      figures: [
        { id: 'hex', name: 'Hexágono' },
        { id: 'square', name: 'Cuadrado' },
        { id: 'triangle', name: 'Triángulo' },
      ],
    });
    expect(new HomePresenter(FOUR_GAMES, THREE_FIGURES, textCatalog.en).home()).toEqual({
      title: 'HexaBlock Suite',
      brand: 'HexaBlock',
      suite: 'Suite',
      play: 'Play',
      achievements: 'Achievements',
      figure: 'Board figure',
      figures: [
        { id: 'hex', name: 'Hexagon' },
        { id: 'square', name: 'Square' },
        { id: 'triangle', name: 'Triangle' },
      ],
    });
  });

  // Issue #171: the home screen offers the board figures of the root, in its order.
  it('should_list_each_figure_in_the_order_of_the_root_when_the_home_screen_is_presented', () => {
    const presenter = new HomePresenter(
      FOUR_GAMES,
      [TopologyId.triangle, TopologyId.hex],
      textCatalog.es,
    );

    expect(presenter.home().figures).toEqual([
      { id: 'triangle', name: 'Triángulo' },
      { id: 'hex', name: 'Hexágono' },
    ]);
  });

  it('should_throw_a_range_error_when_the_catalog_lacks_the_name_of_a_figure', () => {
    const { 'figure.square': _square, ...texts } = textCatalog.es;
    const presenter = new HomePresenter(FOUR_GAMES, THREE_FIGURES, texts as typeof textCatalog.es);

    expect(() => presenter.home()).toThrow(
      new RangeError('The text catalog has no text for the key "figure.square".'),
    );
  });

  it('should_list_each_game_in_the_order_of_the_registry_when_the_selector_is_presented', () => {
    const presenter = new HomePresenter(
      gameIds('hexa-merge', 'hexa-lines', 'hexa-sort', 'hexa-fit'),
      THREE_FIGURES,
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
    expect(new HomePresenter(FOUR_GAMES, THREE_FIGURES, textCatalog.en).gameSelector()).toEqual({
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
    const presenter = new HomePresenter(
      [...FOUR_GAMES, GameId.of('hexa-fill')],
      THREE_FIGURES,
      texts,
    );

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
    const presenter = new HomePresenter([GameId.of('hexa-fill')], THREE_FIGURES, textCatalog.es);

    expect(() => presenter.gameSelector()).toThrow(
      new RangeError('The text catalog names no game with this id.'),
    );
  });

  it('should_throw_a_range_error_when_the_catalog_lacks_the_place_of_a_game', () => {
    const texts = { ...textCatalog.es, 'game.hexa-fill.name': 'Hexa Fill' };
    const presenter = new HomePresenter([GameId.of('hexa-fill')], THREE_FIGURES, texts);

    expect(() => presenter.gameSelector()).toThrow(
      new RangeError('The text catalog has no text for the key "game.hexa-fill.place".'),
    );
  });

  // Issue #181: the presenter receives the saved progress of each game from the hook of the
  // map, and the choice of a game with a high score carries the composed record text.
  it('should_add_the_record_text_to_a_choice_when_the_saved_progress_keeps_a_high_score', () => {
    const LINES = GameId.of('hexa-lines');
    const FIT = GameId.of('hexa-fit');
    const progress = GameProgress.start(LINES);
    progress.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));
    const saved: readonly (readonly [GameId, GameProgress | undefined])[] = [
      [LINES, progress],
      [FIT, undefined],
    ];

    const games = new HomePresenter(FOUR_GAMES, THREE_FIGURES, textCatalog.es, saved).gameSelector()
      .games;

    expect(games[0]).toEqual({
      id: 'hexa-lines',
      name: 'Hexa Lines',
      place: 'Estación Línea',
      highScore: 'Récord 36',
    });
    expect(games[1]).toEqual({ id: 'hexa-fit', name: 'Hexa Fit', place: 'La Colmena' });
  });

  // The record text composes the `map.highScore` text of each language with the score, so
  // both catalogs show it.
  it('should_compose_the_record_text_of_each_language_when_the_presenter_reads_the_catalog', () => {
    const LINES = GameId.of('hexa-lines');
    const progress = GameProgress.start(LINES);
    progress.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(2048) }));

    const spanish = new HomePresenter(FOUR_GAMES, THREE_FIGURES, textCatalog.es, [
      [LINES, progress],
    ]).gameSelector().games[0];
    const english = new HomePresenter(FOUR_GAMES, THREE_FIGURES, textCatalog.en, [
      [LINES, progress],
    ]).gameSelector().games[0];

    expect(spanish?.highScore).toBe('Récord 2048');
    expect(english?.highScore).toBe('High score 2048');
  });
});
