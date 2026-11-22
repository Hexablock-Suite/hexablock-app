import path from 'node:path';

import { renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { CONTENT_WIDTH } from '../../src/infrastructure/ui/theme';
import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

// An element of the rendered tree, as a query of the screen gives it.
type Element = ReturnType<typeof screen.getByRole>;

// The flat style of each element from `element` up to the root of the tree. The test renderer
// keeps the content style of a scroll view on the scroll view, so it counts too.
function stylesUpFrom(element: Element): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  for (let at: Element | null = element; at !== null; at = at.parent) {
    for (const style of [at.props.style, at.props.contentContainerStyle]) {
      found.push((StyleSheet.flatten(style) ?? {}) as Record<string, unknown>);
    }
  }
  return found;
}

// True when one element from `element` up holds the centered column of the content.
function isInColumn(element: Element): boolean {
  return stylesUpFrom(element).some(
    (style) =>
      style.maxWidth === CONTENT_WIDTH && style.width === '100%' && style.alignSelf === 'center',
  );
}

// Issue #287: the web build shows the screens on a desktop too. On a wide window the content
// of each screen stays in a centered column of `CONTENT_WIDTH` points, and on a phone the column
// fills the screen. The column is a style, not a measure of the window, so the server render
// of the web export and the browser agree. The real root logs each use case call to the console,
// so the tests keep the console quiet.
describe('content column', () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('should_keep_the_home_screen_in_a_centered_column_when_it_opens', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    expect(isInColumn(screen.getByRole('button', { name: 'Jugar' }))).toBe(true);
  });

  it('should_keep_the_game_selector_map_in_a_centered_column_when_it_opens', async () => {
    await renderRouter(appDir, { initialUrl: '/map' });

    expect(isInColumn(screen.getByRole('header', { name: 'Mapa de mundos' }))).toBe(true);
  });

  it('should_keep_the_achievements_screen_in_a_centered_column_when_it_opens', async () => {
    await renderRouter(appDir, { initialUrl: '/achievements' });

    expect(isInColumn(screen.getByRole('header', { name: 'Logros' }))).toBe(true);
  });

  it('should_keep_the_game_screen_in_a_centered_column_when_it_opens', async () => {
    await renderRouter(appDir, { initialUrl: '/game/hexa-merge' });

    expect(isInColumn(screen.getByRole('header', { name: 'Hexa Merge' }))).toBe(true);
  });

  it('should_center_the_figure_selector_when_the_home_screen_is_wider_than_the_selector', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    const sign = stylesUpFrom(screen.getByRole('radio', { name: 'Hexágono' })).find(
      (style) => style.maxWidth === 360,
    );

    expect(sign).toMatchObject({ alignSelf: 'center', width: '100%' });
  });
});
