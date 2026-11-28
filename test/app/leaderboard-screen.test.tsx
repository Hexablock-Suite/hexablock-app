import path from 'node:path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { generateStaticParams } from '../../app/leaderboard/[gameId]';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { SessionManager } from '../../src/adapters/session-manager';
import { ProgressOwner } from '../../src/application/ports/progress-owner';
import { Session } from '../../src/application/ports/session';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { GameId } from '../../src/domain/shared/game-id';
import { Score } from '../../src/domain/shared/score';
import { DeviceKeyValueStore } from '../../src/infrastructure/device-key-value-store';
import { DeviceSecretStore } from '../../src/infrastructure/device-secret-store';
import { saveIn } from '../support/adapters/saved-progress';
import type { FakeRoutes } from '../support/fake-backend';
import {
  fakeFetch,
  requestsBesideLevels,
  useFakeFetch,
  type FakeFetch,
} from '../support/fake-fetch';
import { repoRoot } from '../support/run-tool';

// The native module of expo-secure-store is missing under Jest, and jest-expo gives functions
// that keep nothing. This mock keeps the session in memory, as the device does.
const mockSecrets = new Map<string, string>();
jest.mock('expo-secure-store/build/ExpoSecureStore', () => ({
  __esModule: true,
  default: {
    getValueWithKeyAsync: (key: string) => Promise.resolve(mockSecrets.get(key) ?? null),
    setValueWithKeyAsync: (value: string, key: string) => {
      mockSecrets.set(key, value);
      return Promise.resolve();
    },
    deleteValueWithKeyAsync: (key: string) => {
      mockSecrets.delete(key);
      return Promise.resolve();
    },
  },
}));

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

const TOKEN = 'token-of-ada';
const ADA = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const GRACE = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const SIGN_IN_NEEDED = 'Inicia sesión para ver la clasificación.';

// A backend that answers both boards for the token of ada and refuses every other token, as the
// token guard of hexablock-api does. The global board of Lines has two players with one rank, and
// the board of `fit-01` ranks ada before grace (DS-4). Every other level has no board (404).
const authorized = (authorization: unknown) => authorization === `Bearer ${TOKEN}`;
const BOARDS: FakeRoutes = {
  '/v1/leaderboard/hexa-lines': (request) =>
    authorized(request.headers.authorization)
      ? {
          status: 200,
          body: {
            gameId: 'hexa-lines',
            highScores: [
              { rank: 1, userId: ADA, username: 'ada', highScore: 2048 },
              { rank: 1, userId: GRACE, username: 'grace', highScore: 2048 },
            ],
            standings: [],
          },
        }
      : { status: 401, body: { statusCode: 401 } },
  '/v1/leaderboard/hexa-fit/levels/fit-01': (request) =>
    authorized(request.headers.authorization)
      ? {
          status: 200,
          body: {
            gameId: 'hexa-fit',
            levelId: 'fit-01',
            entries: [
              { rank: 1, userId: ADA, username: 'ada', stars: 3, moves: 10, elapsedMs: 45000 },
              { rank: 2, userId: GRACE, username: 'grace', stars: 3, moves: 12, elapsedMs: 61000 },
            ],
          },
        }
      : { status: 401, body: { statusCode: 401 } },
};

// Keeps the session of ada on the device, as a sign-in of #45 does.
function signInAda(): Promise<void> {
  return new SessionManager(new DeviceSecretStore()).write(new Session(TOKEN, ADA));
}

// Saves a won `fit-01` with three stars in the progress of ada on the device, as the victory
// screen of #180 does.
async function saveWonFit01(): Promise<void> {
  const game = GameId.of('hexa-fit');
  const progress = GameProgress.start(game);
  progress.recordLevel(
    ProgressRecord.of({
      gameId: game,
      score: Score.of(0),
      levelId: LevelId.of('fit-01'),
      stars: Stars.of(3),
    }),
  );
  const repository = new LocalProgressRepository(
    new DeviceKeyValueStore(),
    new SessionManager(new DeviceSecretStore()),
  );
  await saveIn(repository, progress, ProgressOwner.of(ADA));
}

// The texts of each row on the open board, in the order of the screen: the rank, the name and
// the record, joined by a space.
function rowsShown(): string[][] {
  return screen.getAllByTestId('leaderboard-row').map((row) => [
    within(row)
      .getAllByText(/.+/)
      .map((text) => String(text.props.children))
      .join(' '),
  ]);
}

// Issue #47 (APP-FR-14): the leaderboard screen shows the global board of a game, from a button of
// its world on the map, and the board of a level, from a button of a completed level on the level
// selector. The root of the layout reads both boards from the backend with the global `fetch`,
// which a fake backend answers. The real root logs each use case call, so the tests keep the
// console quiet.
describe('leaderboard route', () => {
  let info: jest.SpyInstance;
  let backend: FakeFetch;
  let spy: jest.SpyInstance;

  beforeEach(async () => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    mockSecrets.clear();
    await AsyncStorage.clear();
    backend = fakeFetch(BOARDS);
    spy = useFakeFetch(backend);
  });

  afterEach(() => {
    info.mockRestore();
    spy.mockRestore();
  });

  // The Done-when line of #47: «A UI test shows both leaderboards from a stubbed API».
  it('should_show_the_rows_of_the_global_board_and_of_a_level_board_when_the_player_opens_both_from_the_map', async () => {
    await signInAda();
    await saveWonFit01();
    const app = await renderRouter(appDir, { initialUrl: '/map' });

    await fireEvent.press(screen.getAllByRole('button', { name: 'Clasificación' })[0]!);
    await screen.findAllByText('2048 puntos');

    expect(app.getPathname()).toBe('/leaderboard/hexa-lines');
    expect(screen.getByRole('header', { name: 'Hexa Lines' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Clasificación global' })).toBeOnTheScreen();
    expect(rowsShown()).toEqual([['1 ada 2048 puntos'], ['1 grace 2048 puntos']]);

    await fireEvent.press(screen.getByRole('button', { name: 'Atrás' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Hexa Fit/ }));
    await screen.findByText('Completado');
    await fireEvent.press(screen.getByRole('button', { name: 'Clasificación' }));
    await screen.findByText('grace');

    expect(app.getPathname()).toBe('/leaderboard/hexa-fit');
    expect(app.getSearchParams()).toEqual({ gameId: 'hexa-fit', figure: 'hex', levelId: 'fit-01' });
    expect(
      screen.getByRole('header', { name: 'Clasificación del nivel fit-01' }),
    ).toBeOnTheScreen();
    expect(rowsShown()).toEqual([
      ['1 ada 3 estrellas · 10 movimientos · 0:45'],
      ['2 grace 3 estrellas · 12 movimientos · 1:01'],
    ]);
    expect(requestsBesideLevels(backend).map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET /v1/leaderboard/hexa-lines',
      'GET /v1/leaderboard/hexa-fit/levels/fit-01',
    ]);
    expect(requestsBesideLevels(backend).map(({ headers }) => headers.authorization)).toEqual([
      `Bearer ${TOKEN}`,
      `Bearer ${TOKEN}`,
    ]);
  });

  // The decision on #47: with no session the screen says that a board needs a signed-in player
  // and offers the account screen. It sends no request.
  it('should_ask_the_player_to_sign_in_and_open_the_account_screen_when_no_player_signed_in', async () => {
    const app = await renderRouter(appDir, { initialUrl: '/leaderboard/hexa-lines' });

    expect(await screen.findByRole('alert', { name: SIGN_IN_NEEDED })).toBeOnTheScreen();
    expect(screen.queryAllByTestId('leaderboard-row')).toEqual([]);
    expect(requestsBesideLevels(backend)).toEqual([]);

    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(app.getPathname()).toBe('/account');
  });

  // An expired token (401) clears the token through `SessionStore.clear()`, as #46 does, keeps
  // the owner of the progress, and shows the same text as no session.
  it('should_clear_the_token_and_ask_the_player_to_sign_in_when_the_backend_refuses_the_token', async () => {
    await new SessionManager(new DeviceSecretStore()).write(new Session('an-expired-token', ADA));

    await renderRouter(appDir, { initialUrl: '/leaderboard/hexa-lines' });

    expect(await screen.findByRole('alert', { name: SIGN_IN_NEEDED })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeOnTheScreen();
    const kept = new SessionManager(new DeviceSecretStore());
    await expect(kept.read()).resolves.toBeUndefined();
    await expect(kept.owner()).resolves.toBe(ADA);
  });

  // A level that the backend does not hold (404) has no board yet: today the square and the
  // triangle levels of Fit (hexablock-api#158).
  it('should_say_that_the_level_has_no_board_yet_when_the_backend_holds_no_board_of_the_level', async () => {
    await signInAda();

    await renderRouter(appDir, { initialUrl: '/leaderboard/hexa-fit?levelId=fit-square-01' });

    expect(
      await screen.findByRole('alert', { name: 'Este nivel aún no tiene clasificación.' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
    expect(requestsBesideLevels(backend).map(({ url }) => url)).toEqual([
      '/v1/leaderboard/hexa-fit/levels/fit-square-01',
    ]);
  });

  it('should_show_the_empty_text_when_the_board_has_no_row', async () => {
    await signInAda();
    spy.mockRestore();
    backend = fakeFetch({
      '/v1/leaderboard/hexa-merge': {
        status: 200,
        body: { gameId: 'hexa-merge', highScores: [], standings: [] },
      },
    });
    spy = useFakeFetch(backend);

    await renderRouter(appDir, { initialUrl: '/leaderboard/hexa-merge' });

    expect(
      await screen.findByText('Aún nadie tiene un resultado en esta clasificación.'),
    ).toBeOnTheScreen();
  });

  it('should_go_to_the_map_when_the_leaderboard_route_names_no_registered_game', async () => {
    await renderRouter(appDir, { initialUrl: '/leaderboard/hexa-fill' });

    expect(screen).toHavePathname('/map');
  });

  // The web export renders one page of the route for each registered game (#287).
  it('should_render_one_page_for_each_registered_game_when_the_web_export_runs', () => {
    expect(generateStaticParams()).toEqual([
      { gameId: 'hexa-lines' },
      { gameId: 'hexa-fit' },
      { gameId: 'hexa-sort' },
      { gameId: 'hexa-merge' },
    ]);
  });
});
