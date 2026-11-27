import path from 'node:path';

import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { FakeRoutes } from '../support/fake-backend';
import {
  fakeFetch,
  requestsBesideLevels,
  useFakeFetch,
  type FakeFetch,
} from '../support/fake-fetch';
import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

const TOKEN = 'token-of-ada';
const USER = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

// A backend that knows ada with the password `correct horse battery`.
const ADA_BACKEND: FakeRoutes = {
  '/v1/auth/login': (request) =>
    JSON.parse(request.body).password === 'correct horse battery'
      ? { status: 200, body: { accessToken: TOKEN } }
      : { status: 401, body: { statusCode: 401 } },
  '/v1/auth/me': { status: 200, body: { userId: USER } },
};

// Issue #45 (APP-FR-12): the account screen signs the player up or in against the backend.
// The root of the layout sends each request with the global `fetch`, which a fake backend answers.
// The real root logs each use case call to the console, so the tests keep the console quiet.
describe('account route', () => {
  let info: jest.SpyInstance;
  let backend: FakeFetch;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    backend = fakeFetch(ADA_BACKEND);
    spy = useFakeFetch(backend);
  });

  afterEach(() => {
    info.mockRestore();
    spy.mockRestore();
  });

  // Fills the form and presses the button with the name `button`.
  async function send(button: string, password: string): Promise<void> {
    await fireEvent.changeText(screen.getByLabelText('Nombre de usuario'), 'ada');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), password);
    await fireEvent.press(screen.getByRole('button', { name: button }));
  }

  it('should_open_the_account_screen_from_home_and_go_back_when_the_player_presses_both_buttons', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('button', { name: 'Cuenta' }));

    expect(screen).toHavePathname('/account');
    expect(screen.getByRole('header', { name: 'Cuenta' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Atrás' }));

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'HexaBlock Suite' })).toBeOnTheScreen();
  });

  it('should_show_the_signed_in_text_when_the_player_signs_in_with_the_form', async () => {
    await renderRouter(appDir, { initialUrl: '/account' });

    await send('Iniciar sesión', 'correct horse battery');

    expect(await screen.findByText('Sesión iniciada como ada')).toBeOnTheScreen();
    expect(requestsBesideLevels(backend).map(({ method, url }) => `${method} ${url}`)).toEqual([
      'POST /v1/auth/login',
      'GET /v1/auth/me',
    ]);
    expect(requestsBesideLevels(backend)[1]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  // The sign-up creates the account, and the sign-in after it fails.
  it('should_tell_the_player_to_sign_in_when_the_sign_up_succeeds_and_the_sign_in_after_it_fails', async () => {
    spy.mockRestore();
    backend = fakeFetch({
      '/v1/auth/register': { status: 201, body: {} },
      '/v1/auth/login': { status: 500, body: { statusCode: 500 } },
    });
    spy = useFakeFetch(backend);
    await renderRouter(appDir, { initialUrl: '/account' });

    await send('Crear cuenta', 'correct horse battery');

    expect(
      await screen.findByRole('alert', {
        name: 'Tu cuenta se creó, pero no se pudo iniciar sesión. Inicia sesión.',
      }),
    ).toBeOnTheScreen();
  });

  it('should_clear_the_password_field_when_the_sign_in_succeeds', async () => {
    await renderRouter(appDir, { initialUrl: '/account' });

    await send('Iniciar sesión', 'correct horse battery');

    expect(await screen.findByText('Sesión iniciada como ada')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contraseña').props.value).toBe('');
    expect(screen.getByLabelText('Nombre de usuario').props.value).toBe('ada');
  });

  it('should_clear_the_password_field_when_the_sign_in_fails', async () => {
    await renderRouter(appDir, { initialUrl: '/account' });

    await send('Iniciar sesión', 'wrong horse battery');

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  });

  it('should_show_the_error_text_as_an_alert_when_the_backend_refuses_the_password', async () => {
    await renderRouter(appDir, { initialUrl: '/account' });

    await send('Iniciar sesión', 'wrong horse battery');

    expect(
      await screen.findByRole('alert', {
        name: 'El nombre de usuario o la contraseña no son correctos.',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Sesión iniciada como ada')).toBeNull();
  });
});
