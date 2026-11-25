import path from 'node:path';

import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { spaces } from '../support/ui/board-spaces';
import { outlinesIn } from '../support/ui/cell-outlines';
import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// The Spanish names of the four registered games, in the order of the registry.
const FOUR_VARIANTS = ['Hexa Lines', 'Hexa Fit', 'Hexa Sort', 'Hexa Merge'];

// A drawn host element, as the queries of the screen give it.
type Drawn = ReturnType<typeof screen.getByRole>;

// Every element below `element`, `element` included.
function descendants(element: Drawn): Drawn[] {
  const children = (element.children ?? []).filter(
    (child): child is Drawn => typeof child !== 'string',
  );
  return [element, ...children.flatMap(descendants)];
}

// The colors that the world of the game `name` draws on the open map, in the order
// of the tree: the shade, the stone and its inner face. A view gives its background color,
// and an outline gives its fill.
function colorsOfWorld(name: string): unknown[] {
  const world = screen.getByRole('button', { name: new RegExp(`^${name}`) });
  return descendants(world)
    .flatMap((each) => [
      (StyleSheet.flatten(each.props.style) ?? {}).backgroundColor,
      each.props.fill,
    ])
    .filter((color) => color !== undefined);
}

// The text of each board figure in the route, and the corner count and the way
// of the outline of its origin cell (#297).
const FIGURE_SHAPES = [
  { figure: 'hex', shape: { corners: 6, points: 'pointy' } },
  { figure: 'square', shape: { corners: 4, points: 'flat' } },
  { figure: 'triangle', shape: { corners: 3, points: 'up' } },
];

// Issue #169: the game selector map lists the games of the registry and opens each one.
// Since #170 the game route shows `GameScreen`, whose header names the game.
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

  // Issue #171: the map lists the games of the chosen figure. Fit offers only the levels
  // of the figure (S3-08 in #151, a proposal). Since #354 the square and the triangle have
  // a first Fit level, so their maps show Fit, and Fit starts its first level of three cells.
  it('should_list_the_four_games_and_start_the_first_fit_level_when_the_route_names_the_square_or_the_triangle', async () => {
    const seen: [string, string[], number][] = [];

    for (const figure of ['square', 'triangle']) {
      await renderRouter(appDir, { initialUrl: `/map?figure=${figure}` });
      const shown = FOUR_VARIANTS.filter(
        (name) => screen.queryByRole('button', { name: new RegExp(`^${name}`) }) !== null,
      );
      await fireEvent.press(screen.getByRole('button', { name: /^Hexa Fit/ }));
      await screen.findByText('En juego');
      seen.push([figure, shown, spaces().length]);
      await screen.unmount();
    }

    expect(seen).toEqual([
      ['square', FOUR_VARIANTS, 3],
      ['triangle', FOUR_VARIANTS, 3],
    ]);
  });

  // Issue #298: a game keeps its color on the map of every figure.
  it('should_show_each_game_in_one_color_when_the_maps_of_the_hexagon_and_the_square_list_it', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });
    const onHexagon = FOUR_VARIANTS.map(colorsOfWorld);
    await testRouter.replace('/map?figure=square');
    const onSquare = FOUR_VARIANTS.map(colorsOfWorld);

    expect(onHexagon.every((colors) => colors.length > 0)).toBe(true);
    expect(new Set(onHexagon.map((colors) => JSON.stringify(colors))).size).toBe(4);
    expect(onSquare).toEqual(onHexagon);
  });

  // Issue #298: the side of a world follows its place in the list, so the path zig-zags.
  // Since #354 the square lists the four games, as the hexagon does.
  it('should_put_the_worlds_on_alternate_sides_when_the_map_of_the_square_opens', async () => {
    await renderRouter(appDir, { initialUrl: '/map?figure=square' });

    const sides = FOUR_VARIANTS.map(
      (name) =>
        StyleSheet.flatten(screen.getByRole('button', { name: new RegExp(`^${name}`) }).props.style)
          .alignSelf,
    );

    expect(sides).toEqual(['flex-start', 'flex-end', 'flex-start', 'flex-end']);
  });

  // Issue #297: the marker of each game on the map has the shape of the figure of the map
  // (APP-FR-16, decision A of 2026-11-17).
  it('should_draw_each_marker_in_the_shape_of_the_figure_when_the_map_of_that_figure_opens', async () => {
    const drawn: { figure: string; shapes: unknown[] }[] = [];
    for (const { figure } of FIGURE_SHAPES) {
      await renderRouter(appDir, { initialUrl: `/map?figure=${figure}` });
      const worlds = screen.getAllByRole('button', { name: /^Hexa / });
      const outlines = worlds.map((world) => outlinesIn(world));
      expect(worlds.length).toBeGreaterThan(0);
      for (const each of outlines) expect(each.length).toBeGreaterThan(0);
      drawn.push({
        figure,
        shapes: [...new Set(outlines.flat().map((each) => JSON.stringify(each)))],
      });
    }

    expect(drawn).toEqual(
      FIGURE_SHAPES.map(({ figure, shape }) => ({ figure, shapes: [JSON.stringify(shape)] })),
    );
  });

  it('should_go_to_the_home_screen_when_the_map_route_names_no_figure_of_the_root', async () => {
    await renderRouter(appDir, { initialUrl: '/map?figure=circle' });

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'HexaBlock Suite' })).toBeOnTheScreen();
  });

  it('should_go_to_the_home_screen_when_the_game_route_names_no_figure_of_the_root', async () => {
    await renderRouter(appDir, { initialUrl: '/game/hexa-lines?figure=circle' });

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'HexaBlock Suite' })).toBeOnTheScreen();
  });

  // Since #354 every registered game runs on every figure, so the route names a game id
  // that no registry of the root holds.
  it('should_go_to_the_map_of_the_figure_when_the_game_route_names_no_game_of_that_figure', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/game/hexa-fill?figure=triangle' });

    expect(screen).toHavePathname('/map');
    expect(app.getSearchParams()).toEqual({ figure: 'triangle' });
  });
});
