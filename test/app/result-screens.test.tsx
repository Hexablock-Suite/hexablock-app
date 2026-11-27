import path from 'node:path';

import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { repoRoot } from '../support/run-tool';
import { pressSpace } from '../support/ui/board-spaces';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// Issue #180 (the check of #39, APP-FR-07): a game ends on the victory screen or on the defeat
// screen, and the player uses their buttons. The tests play the first Sort level of the square,
// `sort-square-01`: a board of 3 by 3 cells and five fixed stacks, so every run is the same.
// The spaces go in reading order, so 0, 2, 6 and 8 are the corners and 4 is the center.
// The real root logs each use case call to the console, so the tests keep the console quiet.
describe('result screens', () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  // The five stacks on the corners and on the center touch no stack of their top color,
  // so no run moves and no goal clears: the last stack loses the level. The retry starts
  // the level again. The three red stacks on a corner and on its two neighbors make 10 red
  // tiles, which clears the goal: the level is won, and the next level opens on the route.
  it('should_reach_the_defeat_and_the_victory_screens_and_use_their_buttons_when_the_player_loses_and_wins_a_level', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/levels/hexa-sort?figure=square' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Nivel 1\b/ }));
    await screen.findByText('En juego');

    for (const space of [0, 2, 6, 8, 4]) await pressSpace(space);
    expect(await screen.findByRole('header', { name: 'Fin de la partida' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('En juego');
    const closed = screen.queryByRole('header', { name: 'Fin de la partida' });

    for (const space of [0, 1, 3]) await pressSpace(space);
    expect(await screen.findByRole('header', { name: '¡Ganaste!' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente nivel' }));
    await screen.findByText('En juego');

    expect(closed).toBeNull();
    expect(screen.queryByRole('header', { name: '¡Ganaste!' })).toBeNull();
    expect(app.getPathname()).toBe('/game/hexa-sort');
    expect(app.getSearchParams()).toEqual({
      gameId: 'hexa-sort',
      figure: 'square',
      levelId: 'sort-square-02',
    });
  });

  // The way back to the map of the result screens goes to the map of the figure.
  it('should_return_to_the_map_of_the_figure_when_the_player_presses_back_on_the_defeat_screen', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/levels/hexa-sort?figure=square' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Nivel 1\b/ }));
    await screen.findByText('En juego');
    for (const space of [0, 2, 6, 8, 4]) await pressSpace(space);

    await fireEvent.press(await screen.findByRole('button', { name: 'Volver al mapa' }));

    expect(screen).toHavePathname('/map');
    expect(app.getSearchParams()).toEqual({ figure: 'square' });
  });
});
