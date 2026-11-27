import { useEffect, useState } from 'react';

import type { AccountViewModel } from '../../adapters/account-presenter';
import { useScreenServices } from './screen-services';

// What the account screen sends: the username and the password of the form.
export interface AccountForm {
  readonly username: string;
  readonly password: string;
}

// The view model of the account screen and its two actions (#45). The composition root builds
// one `AccountPresenter` over its `Register` and `Login`, and the hook keeps it for the life of
// the screen. The screen attaches as the view of the presenter when it opens, and detaches when
// it closes.
export function useAccount(): {
  readonly model: AccountViewModel;
  readonly signUp: (form: AccountForm) => void;
  readonly signIn: (form: AccountForm) => void;
} {
  const services = useScreenServices();
  const [presenter] = useState(() => services.accountPresenter());
  const [model, setModel] = useState(() => presenter.viewModel());
  useEffect(() => {
    presenter.attach({ show: setModel });
    return () => presenter.detach();
  }, [presenter]);
  return {
    model,
    signUp: (form) => void presenter.onRegister(form),
    signIn: (form) => void presenter.onLogin(form),
  };
}
