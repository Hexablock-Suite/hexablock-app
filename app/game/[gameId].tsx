import { Redirect, router, useLocalSearchParams } from 'expo-router';

import type { GameChoice } from '../../src/adapters/home-presenter';
import { GameId } from '../../src/domain/engine/game-id';
import { GameStage } from '../../src/infrastructure/ui/game-stage';
import { useGameSession } from '../../src/infrastructure/ui/game-session';
import { useHomePresenter } from '../../src/infrastructure/ui/use-home-presenter';

// The game screen, the route of one game (issue #170, S3-07 in #151, a proposal that waits
// for the team). The game selector map opens it with the id of a registered game. It keeps
// the session of that game: the presenter over the use cases of the composition root, and the
// cell renderer and the figure layout of its registry entry. `GameStage` shows the board,
// the score and the outcome. An id that names no registered game goes back to the map.
export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useHomePresenter()
    .gameSelector()
    .games.find((choice) => choice.id === gameId);
  if (game === undefined) return <Redirect href="/map" />;
  return <Game key={game.id} game={game} />;
}

// One registered game. The session lives as long as the screen of the game.
function Game({ game }: { readonly game: GameChoice }) {
  const session = useGameSession(GameId.of(game.id));
  return (
    <GameStage
      title={game.name}
      presenter={session.presenter}
      renderer={session.renderer}
      layoutOf={session.layoutOf}
      onBack={() => router.dismissTo('/map')}
    />
  );
}
