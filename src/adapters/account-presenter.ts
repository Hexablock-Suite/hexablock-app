import type { Credentials } from '../application/credentials';
import type { FailureCode, Result } from '../application/result';
import type { Session } from '../application/session';
import type { UseCase } from '../application/use-case';
import type { TextKey, Texts } from './texts/text-catalog';

// The view model of the account screen (MVP, issue #45, APP-FR-12). It is plain data.
export interface AccountViewModel {
  readonly title: string;
  // The label of the button that goes back.
  readonly back: string;
  // The labels of the two fields of the form.
  readonly username: string;
  readonly password: string;
  // The labels of the two buttons that send the form.
  readonly signUp: string;
  readonly signIn: string;
  // The text of a request that runs. The screen sends no second request while it shows it.
  readonly busy?: string;
  // The text of a successful sign-up or sign-in, with the username of the form.
  readonly signedIn?: string;
  // The text of a failed sign-up or sign-in.
  readonly error?: string;
}

// The view of MVP: the screen that shows each new view model.
export interface AccountView {
  show(model: AccountViewModel): void;
}

// The text of each failure code (issue #322, classes.md decision 62). The table is a `Record`
// over the closed set of codes, so a new code with no text fails the type check.
// The five failures of the account have their own text. Every other failure shows the general
// text `account.error`, `register-failed` and `login-failed` too.
const ERROR_TEXTS: Readonly<Record<FailureCode, TextKey>> = {
  'start-failed': 'account.error',
  'no-running-game': 'account.error',
  'move-rejected': 'account.error',
  'move-failed': 'account.error',
  'publish-failed': 'account.error',
  'no-undo': 'account.error',
  'nothing-to-undo': 'account.error',
  'undo-failed': 'account.error',
  'nothing-to-redo': 'account.error',
  'redo-failed': 'account.error',
  'save-failed': 'account.error',
  'load-failed': 'account.error',
  'list-failed': 'account.error',
  'level-locked': 'account.error',
  'username-taken': 'account.error.username-taken',
  'wrong-credentials': 'account.error.wrong-credentials',
  'invalid-credentials': 'account.error.invalid-credentials',
  'backend-unreachable': 'account.error.backend-unreachable',
  'register-failed': 'account.error',
  'login-failed': 'account.error',
  'sign-in-after-sign-up-failed': 'account.error.sign-in-after-sign-up-failed',
  'unexpected-failure': 'account.error',
};

// The presenter of the account screen (MVP, issue #45, APP-FR-12, flows.md use case 5).
// It lives in layer 3 and imports no React. It calls `Register` and `Login` through the
// `UseCase` input port (decision 9), so it never sees a concrete use case. It reads no field of
// the `Session`: the token stays in the session store.
// While a request runs, the view model holds the busy text. A success shows the signed-in text
// with the username of the form. A failed `Result` never throws (decision 28): the presenter
// shows the text of its code. Every text comes from the catalog of one language (APP-FR-11).
// A view attaches to see each new view model. It sees the current one at once.
export class AccountPresenter {
  private model: AccountViewModel;
  private view: AccountView | undefined;

  constructor(
    private readonly register: UseCase<Credentials, Session>,
    private readonly login: UseCase<Credentials, Session>,
    private readonly texts: Texts,
  ) {
    this.model = this.form();
  }

  // The view sees the current view model at once, and each later one.
  attach(view: AccountView): void {
    this.view = view;
    view.show(this.model);
  }

  // The view sees no later view model.
  detach(): void {
    this.view = undefined;
  }

  viewModel(): AccountViewModel {
    return this.model;
  }

  // Signs the player up with the credentials of the form, through `Register`.
  onRegister(credentials: Credentials): Promise<void> {
    return this.send(this.register, credentials);
  }

  // Signs the player in with the credentials of the form, through `Login`.
  onLogin(credentials: Credentials): Promise<void> {
    return this.send(this.login, credentials);
  }

  private async send(
    useCase: UseCase<Credentials, Session>,
    credentials: Credentials,
  ): Promise<void> {
    this.present({ ...this.form(), busy: this.texts['account.busy'] });
    const result: Result<Session> = await useCase.execute(credentials);
    this.present(
      result.ok
        ? { ...this.form(), signedIn: `${this.texts['account.signed-in']} ${credentials.username}` }
        : { ...this.form(), error: this.texts[ERROR_TEXTS[result.error.code]] },
    );
  }

  // The labels of the form, with no answer.
  private form(): AccountViewModel {
    return {
      title: this.texts['account.title'],
      back: this.texts['account.back'],
      username: this.texts['account.username'],
      password: this.texts['account.password'],
      signUp: this.texts['account.sign-up'],
      signIn: this.texts['account.sign-in'],
    };
  }

  private present(model: AccountViewModel): void {
    this.model = model;
    this.view?.show(model);
  }
}
