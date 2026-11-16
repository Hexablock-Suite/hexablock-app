import path from 'node:path';

import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';

import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// The Spanish names of the four registered games, in the order of the registry.
const FOUR_VARIANTS = ['Hexa Lines', 'Hexa Fit', 'Hexa Sort', 'Hexa Merge'];

// Issue #169: the game selector map lists the games of the registry and opens each one.
// The game route is a placeholder until #170 builds `GameScreen` on it.
describe('GameSelectorScreen', () => {
  // The check of APP-FR-01 (#36): a UI test opens each of the four variants from the selector.
  it('should_open_each_of_the_four_variants_when_the_player_picks_it_on_the_map', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/map' });
    const opened: string[] = [];

    for (const name of FOUR_VARIANTS) {
      await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
      expect(screen.getByRole('header', { name })).toBeOnTheScreen();
      opened.push(app.getPathname());
      await testRouter.back('/map');
    }

    expect(opened).toEqual([
      '/game/hexa-lines',
      '/game/hexa-fit',
      '/game/hexa-sort',
      '/game/hexa-merge',
    ]);
  });

  it('should_return_to_the_home_screen_when_the_player_presses_back', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });

    await fireEvent.press(screen.getByRole('button', { name: 'Atrás' }));

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'HexaBlock Suite' })).toBeOnTheScreen();
  });

  it('should_go_to_the_map_when_the_game_route_names_no_registered_game', async () => {
    await renderRouter(appDir, { initialUrl: '/game/hexa-fill' });

    expect(screen).toHavePathname('/map');
    expect(screen.getByRole('header', { name: 'Mapa de mundos' })).toBeOnTheScreen();
  });
});
