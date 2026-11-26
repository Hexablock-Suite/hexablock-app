import path from 'node:path';

import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { generateStaticParams } from '../../app/game/[gameId]';
import { repoRoot } from '../support/run-tool';
import { occupiedSpaces, pressSpace } from '../support/ui/board-spaces';
import { outlinesIn } from '../support/ui/cell-outlines';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// The Spanish name of each registered game, the buttons that open it from the map and the
// count of spaces of its first board: the hexagon of radius 4 of Lines, the bundled level
// `fit-01` of six cells, and the hexagon of radius 2 of Sort and Merge (docs/REQUIREMENTS.md §1).
// Since #173 the map opens the level selector of Fit and Sort, and the player opens level 1.
const FOUR_BOARDS = [
  { id: 'hexa-lines', name: 'Hexa Lines', presses: [/^Hexa Lines/], spaces: 61 },
  { id: 'hexa-fit', name: 'Hexa Fit', presses: [/^Hexa Fit/, /^Nivel 1\b/], spaces: 6 },
  { id: 'hexa-sort', name: 'Hexa Sort', presses: [/^Hexa Sort/, /^Nivel 1\b/], spaces: 19 },
  { id: 'hexa-merge', name: 'Hexa Merge', presses: [/^Hexa Merge/], spaces: 19 },
];

// Opens the first level of the game `name` from the open map, through its level selector (#173).
async function openFirstLevel(name: string): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Nivel 1\b/ }));
  await screen.findByText('En juego');
}

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
    const drawn: (typeof FOUR_BOARDS)[number][] = [];

    for (const board of FOUR_BOARDS) {
      for (const name of board.presses) {
        await fireEvent.press(await screen.findByRole('button', { name }));
      }
      await screen.findByText('En juego');

      expect(app.getPathname()).toBe(`/game/${board.id}`);
      expect(screen.getByRole('header', { name: board.name })).toBeOnTheScreen();
      expect(screen.getByLabelText('Tablero')).toBeOnTheScreen();
      drawn.push({
        ...board,
        // The renderer hides each space from the screen reader: the board carries the name.
        spaces: screen.getAllByTestId(/^space-(free|occupied)$/, { includeHiddenElements: true })
          .length,
      });
      await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));
    }

    expect(drawn).toEqual(FOUR_BOARDS);
    expect(info).toHaveBeenCalledWith('StartGame: success');
  });

  // Issue #175: the player solves the Fit level of the hexagon on the game screen. The level
  // has the spaces (0,0), (1,0) and (2,0) in a row, the domino `a` and the single cell `b`.
  // Since #173 the map opens the level selector, so the test opens the game route with no
  // level id, which starts that first level of the figure.
  it('should_reach_the_victory_outcome_when_the_player_solves_the_fit_level_of_the_route_with_no_level', async () => {
    await renderRouter(appDir, { initialUrl: '/game/hexa-fit' });
    await screen.findByText('En juego');

    await fireEvent.press(screen.getByRole('radio', { name: 'Pieza a' }));
    await pressSpace(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pieza b' }));
    await pressSpace(2);

    expect(await screen.findByText('¡Victoria!')).toBeOnTheScreen();
    expect(occupiedSpaces()).toEqual([0, 1, 2]);
    expect(screen.queryAllByRole('radio')).toEqual([]);
  });

  it('should_place_the_offer_without_showing_undo_when_the_sort_player_presses_a_free_space', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });
    await openFirstLevel('Hexa Sort');

    expect(occupiedSpaces()).toEqual([]);
    await pressSpace(0);

    expect(occupiedSpaces()).toEqual([0]);
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('should_return_to_the_map_when_the_player_presses_the_map_button', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });
    await openFirstLevel('Hexa Sort');

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(screen).toHavePathname('/map');
    expect(screen.getByRole('header', { name: 'Mapa de mundos' })).toBeOnTheScreen();
  });

  // Issue #171: the map button of the game screen goes back to the map of the chosen figure.
  it('should_return_to_the_map_of_the_figure_when_the_player_presses_the_map_button', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/map?figure=triangle' });
    await openFirstLevel('Hexa Sort');

    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));

    expect(screen).toHavePathname('/map');
    expect(app.getSearchParams()).toEqual({ figure: 'triangle' });
    // Since #354 Fit is on the map of every figure. The marker of a world on the map of the
    // triangle has the shape of the triangle (#297).
    expect(
      new Set(outlinesIn(screen.getByRole('button', { name: /^Hexa Sort/ })).map((o) => o.corners)),
    ).toEqual(new Set([3]));
  });

  // Issue #287: the web export renders one page of the game route for each registered game,
  // so a reload of a game screen finds its page. Each id comes once, though Lines, Sort
  // and Merge are on every figure.
  it('should_list_each_registered_game_once_when_the_web_export_asks_for_the_game_pages', () => {
    expect(generateStaticParams()).toEqual(FOUR_BOARDS.map(({ id }) => ({ gameId: id })));
  });
});
