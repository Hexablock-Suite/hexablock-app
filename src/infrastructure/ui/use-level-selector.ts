import { useEffect, useState } from 'react';

import {
  LevelSelectorPresenter,
  type LevelSelectorViewModel,
} from '../../adapters/level-selector-presenter';
import { DEFAULT_LANGUAGE, textCatalog } from '../../adapters/texts/text-catalog';
import type { GameId } from '../../domain/engine/game-id';
import type { TopologyId } from '../../domain/engine/geometry-factory';
import { useCompositionRoot } from '../composition-root-provider';

// The view model of the level selector of the game `gameId` on the board figure `figure` (#173).
// The hook keeps one `LevelSelectorPresenter` over `ListLevels` of the composition root for the
// life of the screen. The screen attaches as the view of the presenter and reads the levels
// when it opens. It detaches when it closes. The screens show the default language until
// the player can choose one (#163).
export function useLevelSelector(gameId: GameId, figure: TopologyId): LevelSelectorViewModel {
  const root = useCompositionRoot();
  const [presenter] = useState(
    () =>
      new LevelSelectorPresenter(
        root.listLevels(),
        { gameId, figure },
        textCatalog[DEFAULT_LANGUAGE],
      ),
  );
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onOpen();
    return () => presenter.detach();
  }, [presenter]);
  return model;
}
