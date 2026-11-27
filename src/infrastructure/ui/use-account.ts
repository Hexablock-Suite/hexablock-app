import { useEffect, useState } from 'react';

import type { AccountViewModel } from '../../adapters/account-presenter';
import { useScreenServices } from './screen-services';

// What the account screen sends: the username and the password of the form.
export interface AccountForm {
  readonly username: string;
  readonly password: string;
}

// The view model of the account screen and its two actions (#45). Each action gives a promise
// that settles when the request ends, so the screen can clear the password then. The composition root builds
// one `AccountPresenter` over its `Register` and `Login`, and the hook keeps it for the life of
// the screen. The screen attaches as the view of the presenter when it opens, and detaches when
// it closes.
export function useAccount(): {
  readonly model: AccountViewModel;
  readonly signUp: (form: AccountForm) => Promise<void>;
  readonly signIn: (form: AccountForm) => Promise<void>;
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
    signUp: (form) => presenter.onRegister(form),
    signIn: (form) => presenter.onLogin(form),
  };
}
