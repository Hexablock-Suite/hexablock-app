import path from 'node:path';

import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// Issue #169: the home screen shows the suite name and opens the game selector map,
// which is its own route after home (S3-11 in #151, a proposal that waits for the team).
describe('HomeScreen', () => {
  it('should_show_suite_title_when_home_screen_renders', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    expect(screen.getByRole('header', { name: 'HexaBlock Suite' })).toBeOnTheScreen();
  });

  it('should_open_the_game_selector_map_when_the_player_presses_play', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('button', { name: 'Jugar' }));

    expect(screen).toHavePathname('/map');
    expect(screen.getByRole('header', { name: 'Mapa de mundos' })).toBeOnTheScreen();
  });
});
