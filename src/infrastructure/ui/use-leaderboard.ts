import { useEffect, useState } from 'react';

import type { LeaderboardViewModel } from '../../adapters/leaderboard-presenter';
import type { LevelId } from '../../domain/progress/level-id';
import type { GameId } from '../../domain/shared/game-id';
import { useScreenServices } from './screen-services';

// The view model of the leaderboard screen of the game `gameId` (#47): the board of the level
// `levelId`, or the global board of the game with no level. The composition root builds one
// `LeaderboardPresenter` over its two leaderboard use cases (#411), and the hook keeps it for the
// life of the screen. The screen attaches as the view of the presenter and reads the board when it
// opens. It detaches when it closes.
export function useLeaderboard(gameId: GameId, levelId: LevelId | undefined): LeaderboardViewModel {
  const services = useScreenServices();
  const [presenter] = useState(() => services.leaderboardPresenter(gameId, levelId));
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onOpen();
    return () => presenter.detach();
  }, [presenter]);
  return model;
}
