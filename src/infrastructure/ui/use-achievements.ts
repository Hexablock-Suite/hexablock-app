import { useEffect, useState } from 'react';

import type { AchievementsViewModel } from '../../adapters/achievements-presenter';
import { useScreenServices } from './screen-services';

// The view model of the achievements screen (#188). The composition root builds one
// `AchievementsPresenter` over its `ListAchievements` (#411), and the hook keeps it for the life
// of the screen. The screen attaches as the view of the presenter and reads the achievements
// when it opens. It detaches when it closes.
export function useAchievements(): AchievementsViewModel {
  const services = useScreenServices();
  const [presenter] = useState(() => services.achievementsPresenter());
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    void presenter.onOpen();
    return () => presenter.detach();
  }, [presenter]);
  return model;
}
