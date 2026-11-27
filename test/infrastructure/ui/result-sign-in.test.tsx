import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ResultViewModel } from '../../../src/adapters/result-presenter';
import { DefeatScreen, VictoryScreen } from '../../../src/infrastructure/ui/result-screens';

// Issue #46: when the backend refuses the token after a save, the result screen asks the player to
// sign in. The text and the label come from the view model, and the button opens the account screen.

const BASE: ResultViewModel = {
  victory: false,
  title: 'Fin de la partida',
  scoreLabel: 'Puntuación final',
  score: 36,
  back: 'Volver al mapa',
  retry: 'Reintentar',
};
const SIGN_IN = {
  text: 'Tu sesión venció. Inicia sesión para guardar tu progreso en el servidor.',
  label: 'Iniciar sesión',
};

describe('result screens and the sign-in', () => {
  it('should_show_the_text_and_open_the_sign_in_when_the_model_asks_the_player_to_sign_in', async () => {
    const onSignIn = jest.fn();

    await render(
      <DefeatScreen
        model={{ ...BASE, signIn: SIGN_IN }}
        onRetry={() => undefined}
        onBack={() => undefined}
        onSignIn={onSignIn}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: SIGN_IN.label }));

    expect(screen.getByText(SIGN_IN.text)).toBeOnTheScreen();
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('should_show_the_sign_in_on_the_victory_screen_when_the_model_asks_the_player_to_sign_in', async () => {
    const onSignIn = jest.fn();

    await render(
      <VictoryScreen
        model={{ ...BASE, victory: true, title: '¡Ganaste!', retry: undefined, signIn: SIGN_IN }}
        onNext={() => undefined}
        onNewGame={() => undefined}
        onBack={() => undefined}
        onSignIn={onSignIn}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: SIGN_IN.label }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('should_show_no_sign_in_when_the_model_does_not_ask_for_it', async () => {
    await render(
      <DefeatScreen
        model={BASE}
        onRetry={() => undefined}
        onBack={() => undefined}
        onSignIn={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: SIGN_IN.label })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });
});
