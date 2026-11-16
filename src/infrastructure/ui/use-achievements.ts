import { useEffect, useState } from 'react';

import {
  AchievementsPresenter,
  type AchievementsViewModel,
} from '../../adapters/achievements-presenter';
import { DEFAULT_LANGUAGE, textCatalog } from '../../adapters/texts/text-catalog';
import { useCompositionRoot } from '../composition-root-provider';

// The view model of the achievements screen (#188). The hook keeps one `AchievementsPresenter`
// over `ListAchievements` of the composition root for the life of the screen.
// The screen attaches as the view of the presenter and reads the achievements when it opens.
// It detaches when it closes. The screens show the default language until the player
// can choose one (#163).
export function useAchievements(): AchievementsViewModel {
  const root = useCompositionRoot();
  const [presenter] = useState(
    () => new AchievementsPresenter(root.listAchievements(), textCatalog[DEFAULT_LANGUAGE]),
  );
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onOpen();
    return () => presenter.detach();
  }, [presenter]);
  return model;
}
