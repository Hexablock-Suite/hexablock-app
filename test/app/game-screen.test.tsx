import path from 'node:path';

import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';

import { repoRoot } from '../support/run-tool';
import { occupiedSpaces, pressSpace } from '../support/ui/board-spaces';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// The Spanish name of each registered game and the count of spaces of its first board:
// the hexagon of radius 4 of Lines, the first Fit level of three cells, and the hexagon
// of radius 2 of Sort and Merge (docs/REQUIREMENTS.md §1).
const FOUR_BOARDS = [
  { id: 'hexa-lines', name: 'Hexa Lines', spaces: 61 },
  { id: 'hexa-fit', name: 'Hexa Fit', spaces: 3 },
  { id: 'hexa-sort', name: 'Hexa Sort', spaces: 19 },
  { id: 'hexa-merge', name: 'Hexa Merge', spaces: 19 },
];

// Issue #170: the game route, `GameScreen`, shows the game that the registry holds for
// the id of the route. The real root logs each use case call to the console, so the tests
// keep the console quiet.
describe('game route', () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('should_start_each_game_and_draw_every_space_of_its_board_when_the_player_opens_it_from_the_map', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/map' });
    const drawn: { id: string; name: string; spaces: number }[] = [];

    for (const board of FOUR_BOARDS) {
      await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${board.name}`) }));
      await screen.findByText('En juego');

      expect(app.getPathname()).toBe(`/game/${board.id}`);
      expect(screen.getByRole('header', { name: board.name })).toBeOnTheScreen();
      expect(screen.getByLabelText('Tablero')).toBeOnTheScreen();
      drawn.push({
        id: board.id,
        name: board.name,
        // The renderer hides each space from the screen reader: the board carries the name.
        spaces: screen.getAllByTestId(/^space-(free|occupied)$/, { includeHiddenElements: true })
          .length,
      });
      await testRouter.back('/map');
    }

    expect(drawn).toEqual(FOUR_BOARDS);
    expect(info).toHaveBeenCalledWith('StartGame: success');
  });

  // Issue #175: the player solves the Fit level of the hexagon on the game screen. The level
  // has the spaces (0,0), (1,0) and (2,0) in a row, the domino `a` and the single cell `b`.
  it('should_reach_the_victory_outcome_when_the_player_solves_the_fit_level_from_the_map', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });
    await fireEvent.press(screen.getByRole('button', { name: /^Hexa Fit/ }));
    await screen.findByText('En juego');

    await fireEvent.press(screen.getByRole('radio', { name: 'Pieza a' }));
    await pressSpace(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pieza b' }));
    await pressSpace(2);

    expect(await screen.findByText('¡Victoria!')).toBeOnTheScreen();
    expect(occupiedSpaces()).toEqual([0, 1, 2]);
    expect(screen.queryAllByRole('radio')).toEqual([]);
  });

  it('should_return_to_the_map_when_the_player_presses_the_map_button', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });
    await fireEvent.press(screen.getByRole('button', { name: /^Hexa Sort/ }));
    await screen.findByText('En juego');

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(screen).toHavePathname('/map');
    expect(screen.getByRole('header', { name: 'Mapa de mundos' })).toBeOnTheScreen();
  });

  // Issue #171: the map button of the game screen goes back to the map of the chosen figure.
  it('should_return_to_the_map_of_the_figure_when_the_player_presses_the_map_button', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/map?figure=triangle' });
    await fireEvent.press(screen.getByRole('button', { name: /^Hexa Sort/ }));
    await screen.findByText('En juego');

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(screen).toHavePathname('/map');
    expect(app.getSearchParams()).toEqual({ figure: 'triangle' });
    expect(screen.queryByRole('button', { name: /^Hexa Fit/ })).toBeNull();
  });
});
