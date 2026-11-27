import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { GameChoice } from '../../src/adapters/home-presenter';
import { GameId } from '../../src/domain/shared/game-id';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameStage } from '../../src/infrastructure/ui/game-stage';
import { useGameSession } from '../../src/infrastructure/ui/game-session';
import {
  gameRouteIds,
  useHomePresenter,
  useRouteFigure,
  type RouteFigure,
} from '../../src/infrastructure/ui/use-home-presenter';

// The game screen, the route of one game (issue #170, S3-07 in #151, a proposal that waits
// for the team). The game selector map opens it with the id of a registered game and the text
// of the board figure (#171). It keeps the session of that game on that figure: the presenter
// over the use cases of the composition root, and the cell renderer, the move controls and the
// figure layout of its registry entry (#175). `GameStage` shows the board, the score, the outcome
// and the move controls of the game.
// The level selector also opens it with the id of the chosen level in the `levelId` parameter
// (#173), and the game starts at that level. A route with no level id starts the game with none.
// A text that names no figure goes home. An id that names no game of the figure goes back
// to the map of the figure.
// The route does not protect a level: `StartGame` refuses a locked level, and the screen shows
// the text of that failure (#397). A repeated parameter reaches the route as a list,
// so the route reads the first value of `gameId` and of `levelId`.
export default function GameScreen() {
  const params = useLocalSearchParams<{ gameId: string | string[]; levelId?: string | string[] }>();
  const gameId = firstOf(params.gameId);
  const levelId = firstOf(params.levelId);
  const figure = useRouteFigure();
  const games = useHomePresenter(figure?.figure).gameSelector().games;
  if (figure === undefined) return <Redirect href="/" />;
  const game = games.find((choice) => choice.id === gameId);
  if (game === undefined) {
    return <Redirect href={{ pathname: '/map', params: { figure: figure.param } }} />;
  }
  return (
    <Game
      key={`${figure.param}/${game.id}/${levelId ?? ''}`}
      game={game}
      figure={figure}
      levelId={levelId}
    />
  );
}

// The first value of a route parameter. A repeated parameter arrives as a list.
function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// The pages of this route that the web export renders, one for each registered game (#287).
// Expo Router calls it at build time when `web.output` is `static`. A static page holds
// no query: it shows the hexagon, and the browser draws the page again for another figure.
export function generateStaticParams(): { gameId: string }[] {
  return gameRouteIds().map((gameId) => ({ gameId }));
}

// One registered game on one board figure, at the level whose text is `levelId` when the route
// names one. The session and the level id live as long as the screen of the game.
// A blank level id names no level. The map button goes back to the map of the figure.
function Game({
  game,
  figure,
  levelId,
}: {
  readonly game: GameChoice;
  readonly figure: RouteFigure;
  readonly levelId?: string;
}) {
  const session = useGameSession(GameId.of(game.id), figure.figure);
  const [level] = useState(() =>
    levelId === undefined || levelId.trim() === '' ? undefined : LevelId.of(levelId),
  );
  return (
    <GameStage
      title={game.name}
      presenter={session.presenter}
      renderer={session.renderer}
      controls={session.controls}
      layoutOf={session.layoutOf}
      texts={session.texts}
      onBack={() => router.dismissTo({ pathname: '/map', params: { figure: figure.param } })}
      levelId={level}
    />
  );
}
