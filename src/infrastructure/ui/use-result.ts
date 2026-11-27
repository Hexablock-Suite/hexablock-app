import { useEffect, useState } from 'react';

import type { ResultPresenter, ResultViewModel } from '../../adapters/result-presenter';

// The view model of the victory screen and of the defeat screen of a game session (#180).
// The screen attaches as the view of `presenter` and detaches when it closes.
// `undefined` means no result: the game goes on.
export function useResult(presenter: ResultPresenter): ResultViewModel | undefined {
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    return () => presenter.detach();
  }, [presenter]);
  return model;
}
