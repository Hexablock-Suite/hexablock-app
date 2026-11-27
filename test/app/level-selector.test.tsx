import path from 'node:path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { generateStaticParams } from '../../app/levels/[gameId]';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { Stars } from '../../src/domain/progress/stars';
import { DeviceKeyValueStore } from '../../src/infrastructure/device-key-value-store';
import { repoRoot } from '../support/run-tool';
import { spaces } from '../support/ui/board-spaces';
import { saveIn } from '../support/adapters/saved-progress';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// The Spanish text of each status of a level.
const STATUSES = ['Completado', 'Abierto', 'Bloqueado'];

// Saves a won result of the level `levelId` of the game `gameId` on the device, with two stars,
// as the victory screen of #180 does.
async function saveWonLevel(gameId: string, levelId: string): Promise<void> {
  const game = GameId.of(gameId);
  const progress = GameProgress.start(game);
  progress.recordLevel(
    ProgressRecord.of({
      gameId: game,
      score: Score.of(0),
      levelId: LevelId.of(levelId),
      stars: Stars.of(2),
    }),
  );
  await saveIn(new LocalProgressRepository(new DeviceKeyValueStore()), progress);
}

// The button of each level on the open selector, in the order of the screen.
function levelButtons() {
  return screen.getAllByRole('button', { name: /^Nivel \d+/ });
}

// The status text of each level on the open selector, in the order of the screen.
function statusesShown(): string[] {
  return levelButtons().map(
    (button) => STATUSES.find((status) => within(button).queryByText(status) !== null) ?? '',
  );
}

// Issue #173: the map opens the level selector of Fit and Sort. The selector shows each level
// of the chosen figure as completed, open or locked (APP-FR-02, the check of #37), and a press
// on a level that is not locked starts it by its id (#172). It reads the saved progress of the
// device through `ListLevels` of the composition root. The real root logs each use case call,
// so the tests keep the console quiet.
describe('level selector route', () => {
  let info: jest.SpyInstance;

  beforeEach(async () => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    await AsyncStorage.clear();
  });

  afterEach(() => {
    info.mockRestore();
  });

  // The check of APP-FR-02: the device keeps a won first level of the game. The first level
  // is completed with its stars, the second one is open and every other level is locked.
  it.each([
    { id: 'hexa-fit', name: 'Hexa Fit', first: 'fit-01', count: 15 },
    { id: 'hexa-sort', name: 'Hexa Sort', first: 'sort-01', count: 10 },
  ])(
    'should_show_the_completed_open_and_locked_levels_when_the_player_opens_the_game_after_a_win',
    async ({ id, name, first, count }) => {
      await saveWonLevel(id, first);
      const app = await renderRouter(appDir, { initialUrl: '/map' });

      await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
      await screen.findByText('Completado');

      expect(app.getPathname()).toBe(`/levels/${id}`);
      expect(screen.getByRole('header', { name })).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Niveles' })).toBeOnTheScreen();
      expect(statusesShown()).toEqual([
        'Completado',
        'Abierto',
        ...Array.from({ length: count - 2 }, () => 'Bloqueado'),
      ]);
      expect(within(levelButtons()[0]).getByText('Estrellas 2')).toBeOnTheScreen();
      expect(screen.queryByText('Cargando los niveles')).toBeNull();
    },
  );

  // A press on an open level starts that level by its id: the second Fit level has 7 spaces,
  // and the first Fit level of the figure, which the game starts with no id, has 3.
  it('should_start_the_chosen_level_when_the_player_presses_an_open_level', async () => {
    await saveWonLevel('hexa-fit', 'fit-01');
    const app = await renderRouter(appDir, { initialUrl: '/levels/hexa-fit' });
    await screen.findByText('Abierto');

    await fireEvent.press(screen.getByRole('button', { name: /^Nivel 2/ }));
    await screen.findByText('En juego');

    expect(app.getPathname()).toBe('/game/hexa-fit');
    expect(app.getSearchParams()).toEqual({
      gameId: 'hexa-fit',
      figure: 'hex',
      levelId: 'fit-02',
    });
    expect(spaces()).toHaveLength(7);
  });

  // A locked level does not start: the screen stays on the selector.
  it('should_stay_on_the_selector_when_the_player_presses_a_locked_level', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/levels/hexa-fit' });
    await screen.findByText('Abierto');
    const locked = screen.getByRole('button', { name: /^Nivel 2/ });

    await fireEvent.press(locked);

    expect(locked).toBeDisabled();
    expect(app.getPathname()).toBe('/levels/hexa-fit');
    expect(screen.queryByText('En juego')).toBeNull();
  });

  // Issue #171: the selector lists the levels of the figure of its route, and its map button
  // goes back to the map of that figure. The square has three Sort levels (#354).
  it('should_list_the_levels_of_the_square_and_go_back_to_its_map_when_the_player_presses_the_map_button', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/map?figure=square' });
    await fireEvent.press(screen.getByRole('button', { name: /^Hexa Sort/ }));
    await screen.findByText('Abierto');

    expect(app.getPathname()).toBe('/levels/hexa-sort');
    expect(statusesShown()).toEqual(['Abierto', 'Bloqueado', 'Bloqueado']);

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(app.getPathname()).toBe('/map');
    expect(app.getSearchParams()).toEqual({ figure: 'square' });
  });

  // A failed read of the device shows the error text as an alert, and no level.
  it('should_show_the_error_text_when_the_device_cannot_read_the_progress', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('No disk.'));

    await renderRouter(appDir, { initialUrl: '/levels/hexa-fit' });

    expect(
      await screen.findByRole('alert', {
        name: 'No se pudieron leer los niveles. Vuelve al mapa y ábrelos otra vez.',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryAllByRole('button', { name: /^Nivel \d+/ })).toEqual([]);
    getItem.mockRestore();
  });

  it('should_go_to_the_map_when_the_level_route_names_no_registered_game', async () => {
    await renderRouter(appDir, { initialUrl: '/levels/hexa-fill' });

    expect(screen).toHavePathname('/map');
  });

  // The web export renders one page of the route for each game with levels (#287).
  it('should_render_one_page_for_each_game_with_levels_when_the_web_export_runs', () => {
    expect(generateStaticParams()).toEqual([{ gameId: 'hexa-fit' }, { gameId: 'hexa-sort' }]);
  });
});
