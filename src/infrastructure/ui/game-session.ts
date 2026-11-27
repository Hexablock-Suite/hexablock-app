import { useState } from 'react';

import type { GameId } from '../../domain/shared/game-id';
import type { TopologyId } from '../../domain/shared/topology-id';
import { useScreenServices, type GameSession } from './screen-services';

// The session of the game `gameId` on the board figure `figure` for the life of the screen
// that asks for it. The composition root builds the session and its presenter (#411), and the
// hook keeps it in React state. The screens show the default language until the player can
// choose one (#163).
export function useGameSession(gameId: GameId, figure: TopologyId): GameSession {
  const services = useScreenServices();
  const [session] = useState(() => services.gameSession(gameId, figure));
  return session;
}
