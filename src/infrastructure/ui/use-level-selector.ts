import { useEffect, useState } from 'react';

import type { LevelSelectorViewModel } from '../../adapters/level-selector-presenter';
import type { GameId } from '../../domain/shared/game-id';
import type { TopologyId } from '../../domain/shared/topology-id';
import { useScreenServices } from './screen-services';

// The view model of the level selector of the game `gameId` on the board figure `figure` (#173).
// The composition root builds one `LevelSelectorPresenter` over its `ListLevels` (#411), and the
// hook keeps it for the life of the screen. The screen attaches as the view of the presenter and
// reads the levels when it opens. It detaches when it closes.
export function useLevelSelector(gameId: GameId, figure: TopologyId): LevelSelectorViewModel {
  const services = useScreenServices();
  const [presenter] = useState(() => services.levelSelectorPresenter(gameId, figure));
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onOpen();
    return () => presenter.detach();
  }, [presenter]);
  return model;
}
