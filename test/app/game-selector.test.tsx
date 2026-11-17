import path from 'node:path';

import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

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

// The background colors that the world of the game `name` draws on the open map, in the order
// of the tree: the shade, the stone and its inner face.
function colorsOfWorld(name: string): unknown[] {
  const world = screen.getByRole('button', { name: new RegExp(`^${name}`) });
  return descendants(world)
    .map((each) => (StyleSheet.flatten(each.props.style) ?? {}).backgroundColor)
    .filter((color) => color !== undefined);
}

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

  // Issue #171: the map lists the games of the chosen figure. The first content has a Fit level
  // only on the hexagon, so Fit offers no level on the square (S3-08 in #151, a proposal).
  it('should_list_the_games_of_the_figure_when_the_route_names_the_square', async () => {
    await renderRouter(appDir, { initialUrl: '/map?figure=square' });

    const shown = FOUR_VARIANTS.filter(
      (name) => screen.queryByRole('button', { name: new RegExp(`^${name}`) }) !== null,
    );

    expect(shown).toEqual(['Hexa Lines', 'Hexa Sort', 'Hexa Merge']);
  });

  // Issue #298: a game keeps its color on the map of every figure. Fit has no entry on the square,
  // so Sort and Merge take another place in the list there.
  it('should_show_each_game_in_one_color_when_the_maps_of_the_hexagon_and_the_square_list_it', async () => {
    const games = ['Hexa Sort', 'Hexa Merge'];
    await renderRouter(appDir, { initialUrl: '/map' });
    const onHexagon = games.map(colorsOfWorld);
    await testRouter.replace('/map?figure=square');
    expect(screen.queryByRole('button', { name: /^Hexa Fit/ })).toBeNull();
    const onSquare = games.map(colorsOfWorld);

    expect(onHexagon.every((colors) => colors.length > 0)).toBe(true);
    expect(onHexagon[0]).not.toEqual(onHexagon[1]);
    expect(onSquare).toEqual(onHexagon);
  });

  // Issue #298: the side of a world follows its place in the list, not the game, so the path
  // keeps its zig-zag on the square, where Fit has no entry.
  it('should_put_the_worlds_on_alternate_sides_when_the_square_has_no_fit_entry', async () => {
    await renderRouter(appDir, { initialUrl: '/map?figure=square' });

    const sides = ['Hexa Lines', 'Hexa Sort', 'Hexa Merge'].map(
      (name) =>
        StyleSheet.flatten(screen.getByRole('button', { name: new RegExp(`^${name}`) }).props.style)
          .alignSelf,
    );

    expect(sides).toEqual(['flex-start', 'flex-end', 'flex-start']);
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

  it('should_go_to_the_map_of_the_figure_when_the_game_route_names_a_game_of_another_figure', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/game/hexa-fit?figure=triangle' });

    expect(screen).toHavePathname('/map');
    expect(app.getSearchParams()).toEqual({ figure: 'triangle' });
  });
});
