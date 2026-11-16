import { Redirect, router, useLocalSearchParams } from 'expo-router';

import type { GameChoice } from '../../src/adapters/home-presenter';
import { GameId } from '../../src/domain/engine/game-id';
import { GameStage } from '../../src/infrastructure/ui/game-stage';
import { useGameSession } from '../../src/infrastructure/ui/game-session';
import {
  useHomePresenter,
  useRouteFigure,
  type RouteFigure,
} from '../../src/infrastructure/ui/use-home-presenter';

// The game screen, the route of one game (issue #170, S3-07 in #151, a proposal that waits
// for the team). The game selector map opens it with the id of a registered game and the text
// of the board figure (#171). It keeps the session of that game on that figure: the presenter
// over the use cases of the composition root, and the cell renderer, the figure layout and the
// move controls of its registry entry. `GameStage` shows the board, the score, the outcome
// and the move controls (#177).
// A text that names no figure goes home. An id that names no game of the figure goes back
// to the map of the figure.
export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const figure = useRouteFigure();
  const games = useHomePresenter(figure?.figure).gameSelector().games;
  if (figure === undefined) return <Redirect href="/" />;
  const game = games.find((choice) => choice.id === gameId);
  if (game === undefined) {
    return <Redirect href={{ pathname: '/map', params: { figure: figure.param } }} />;
  }
  return <Game key={`${figure.param}/${game.id}`} game={game} figure={figure} />;
}

// One registered game on one board figure. The session lives as long as the screen of the game.
// The map button goes back to the map of the figure.
function Game({ game, figure }: { readonly game: GameChoice; readonly figure: RouteFigure }) {
  const session = useGameSession(GameId.of(game.id), figure.figure);
  return (
    <GameStage
      title={game.name}
      presenter={session.presenter}
      renderer={session.renderer}
      layoutOf={session.layoutOf}
      controls={session.controls}
      onBack={() => router.dismissTo({ pathname: '/map', params: { figure: figure.param } })}
    />
  );
}
