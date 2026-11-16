import path from 'node:path';

import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';

import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// The Spanish name of each board figure, the text of its `TopologyId` in the route,
// and the count of spaces of the Lines board on it: a region of size 5 holds
// 61 hexagons, 25 squares or 50 triangles (#171).
const THREE_FIGURES = [
  { name: 'Hexágono', figure: 'hex', spaces: 61 },
  { name: 'Cuadrado', figure: 'square', spaces: 25 },
  { name: 'Triángulo', figure: 'triangle', spaces: 50 },
];

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

  // Issue #171: the home screen offers the board figure, and the hexagon is the default figure.
  it('should_check_the_hexagon_when_the_home_screen_opens', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    expect(screen.getByText('Figura del tablero')).toBeOnTheScreen();
    expect(THREE_FIGURES.map(({ name }) => screen.getByRole('radio', { name }))).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Hexágono' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Cuadrado' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Triángulo' })).not.toBeChecked();
  });

  // The check of APP-FR-16 on the screens: a UI test chooses each figure and starts Lines on it.
  it('should_start_lines_on_each_figure_when_the_player_chooses_it_and_plays', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const app = await renderRouter(appDir, { initialUrl: '/' });
    const started: { name: string; figure: string; spaces: number }[] = [];

    for (const { name, figure } of THREE_FIGURES) {
      await fireEvent.press(screen.getByRole('radio', { name }));
      expect(screen.getByRole('radio', { name })).toBeChecked();
      await fireEvent.press(screen.getByRole('button', { name: 'Jugar' }));
      expect(app.getSearchParams()).toEqual({ figure });
      await fireEvent.press(screen.getByRole('button', { name: /^Hexa Lines/ }));
      await screen.findByText('En juego');

      expect(app.getPathname()).toBe('/game/hexa-lines');
      started.push({
        name,
        figure: String(app.getSearchParams().figure),
        // The renderer hides each space from the screen reader: the board carries the name.
        spaces: screen.getAllByTestId(/^space-(free|occupied)$/, { includeHiddenElements: true })
          .length,
      });
      await testRouter.back();
      expect(screen).toHavePathname('/map');
      await testRouter.back();
      expect(screen).toHavePathname('/');
      expect(screen.getByRole('radio', { name })).toBeChecked();
    }

    expect(started).toEqual(THREE_FIGURES);
    info.mockRestore();
  });
});
