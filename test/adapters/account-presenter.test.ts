import { AccountPresenter, type AccountViewModel } from '../../src/adapters/account-presenter';
import { textCatalog, type TextKey } from '../../src/adapters/texts/text-catalog';
import type { Credentials } from '../../src/application/credentials';
import { FailureCode, Result, UseCaseError } from '../../src/application/result';
import { Session } from '../../src/application/session';
import type { SyncProgressRequest } from '../../src/application/sync-progress';
import type { UseCase } from '../../src/application/use-case';
import { GameId } from '../../src/domain/shared/game-id';

// #45 (APP-FR-12): the account screen signs the player up or in, and shows the answer.

const ADA: Credentials = { username: 'ada', password: 'correct horse battery' };
const SESSION = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const es = textCatalog.es;

// A use case that records each request and gives the answers of the test, one per call.
class AnsweringUseCase implements UseCase<Credentials, Session> {
  readonly requests: Credentials[] = [];

  constructor(private readonly answers: Result<Session>[]) {}

  execute(request: Credentials): Promise<Result<Session>> {
    this.requests.push(request);
    const answer = this.answers.shift();
    if (answer === undefined) throw new Error('The test gave no more answers.');
    return Promise.resolve(answer);
  }
}

const failure = (code: FailureCode) =>
  Result.failure<Session>(new UseCaseError(code, 'The backend refused the request.'));

// The labels of the form, in the language of the texts.
const formOf = (texts = es) => ({
  title: texts['account.title'],
  back: texts['account.back'],
  username: texts['account.username'],
  password: texts['account.password'],
  signUp: texts['account.sign-up'],
  signIn: texts['account.sign-in'],
});

function presenterWith(
  register: Result<Session>[] = [],
  login: Result<Session>[] = [],
  texts = es,
) {
  const registerUseCase = new AnsweringUseCase(register);
  const loginUseCase = new AnsweringUseCase(login);
  const presenter = new AccountPresenter(registerUseCase, loginUseCase, texts);
  return { presenter, registerUseCase, loginUseCase };
}

describe('AccountPresenter', () => {
  it('should_show_the_labels_of_the_form_and_no_answer_when_the_screen_opens', () => {
    const { presenter } = presenterWith();
    const shown: AccountViewModel[] = [];

    presenter.attach({ show: (model) => shown.push(model) });

    expect(shown).toEqual([formOf()]);
    expect(presenterWith([], [], textCatalog.en).presenter.viewModel()).toEqual(
      formOf(textCatalog.en),
    );
  });

  it('should_sign_in_and_show_the_signed_in_text_with_the_username_when_the_sign_in_succeeds', async () => {
    const { presenter, loginUseCase, registerUseCase } = presenterWith(
      [],
      [Result.success(SESSION)],
    );

    await presenter.onLogin(ADA);

    expect(loginUseCase.requests).toEqual([ADA]);
    expect(registerUseCase.requests).toEqual([]);
    expect(presenter.viewModel()).toEqual({ ...formOf(), signedIn: 'Sesión iniciada como ada' });
  });

  it('should_sign_up_and_show_the_signed_in_text_when_the_sign_up_succeeds', async () => {
    const { presenter, loginUseCase, registerUseCase } = presenterWith([Result.success(SESSION)]);

    await presenter.onRegister(ADA);

    expect(registerUseCase.requests).toEqual([ADA]);
    expect(loginUseCase.requests).toEqual([]);
    expect(presenter.viewModel()).toEqual({ ...formOf(), signedIn: 'Sesión iniciada como ada' });
  });

  it('should_show_the_busy_text_and_then_the_answer_when_a_request_runs', async () => {
    const { presenter } = presenterWith([], [Result.success(SESSION)]);
    const shown: AccountViewModel[] = [];
    presenter.attach({ show: (model) => shown.push(model) });

    await presenter.onLogin(ADA);

    expect(shown).toEqual([
      formOf(),
      { ...formOf(), busy: es['account.busy'] },
      { ...formOf(), signedIn: 'Sesión iniciada como ada' },
    ]);
  });

  it.each<[FailureCode, TextKey]>([
    [FailureCode.usernameTaken, 'account.error.username-taken'],
    [FailureCode.wrongCredentials, 'account.error.wrong-credentials'],
    [FailureCode.invalidCredentials, 'account.error.invalid-credentials'],
    [FailureCode.backendUnreachable, 'account.error.backend-unreachable'],
    [FailureCode.signInAfterSignUpFailed, 'account.error.sign-in-after-sign-up-failed'],
    [FailureCode.registerFailed, 'account.error'],
    [FailureCode.loginFailed, 'account.error'],
    [FailureCode.unexpectedFailure, 'account.error'],
  ])('should_show_the_text_of_the_failure_code_when_the_use_case_fails', async (code, key) => {
    const { presenter } = presenterWith([failure(code)], [failure(code)]);

    await presenter.onRegister(ADA);
    const afterSignUp = presenter.viewModel();
    await presenter.onLogin(ADA);

    expect(afterSignUp).toEqual({ ...formOf(), error: es[key] });
    expect(presenter.viewModel()).toEqual({ ...formOf(), error: es[key] });
  });

  it('should_clear_the_error_when_a_later_request_succeeds', async () => {
    const { presenter } = presenterWith(
      [],
      [failure(FailureCode.wrongCredentials), Result.success(SESSION)],
    );

    await presenter.onLogin({ username: 'ada', password: 'wrong horse battery' });
    await presenter.onLogin(ADA);

    expect(presenter.viewModel()).toEqual({ ...formOf(), signedIn: 'Sesión iniciada como ada' });
  });

  it('should_show_no_later_view_model_when_the_view_detaches', async () => {
    const { presenter } = presenterWith([], [Result.success(SESSION)]);
    const shown: AccountViewModel[] = [];
    presenter.attach({ show: (model) => shown.push(model) });

    presenter.detach();
    await presenter.onLogin(ADA);

    expect(shown).toEqual([formOf()]);
  });
});

// #46 (APP-FR-13, D27): when the player signs in, the app uploads the progress made with no
// account. The presenter asks `SyncProgress` for each registered game, and the use case merges the
// anonymous progress into the account before it sends it.
describe('AccountPresenter and the sync after a sign-in', () => {
  const GAMES = [GameId.of('hexa-lines'), GameId.of('hexa-fit')];

  // A `SyncProgress` port that keeps each request and answers `answer`.
  class SyncingUseCase implements UseCase<SyncProgressRequest, void> {
    readonly requests: SyncProgressRequest[] = [];
    constructor(private readonly answer: Result<void> = Result.success(undefined)) {}
    execute(request: SyncProgressRequest): Promise<Result<void>> {
      this.requests.push(request);
      return Promise.resolve(this.answer);
    }
  }

  function syncingPresenter(
    login: Result<Session>[],
    register: Result<Session>[],
    sync: SyncingUseCase,
  ) {
    return new AccountPresenter(new AnsweringUseCase(register), new AnsweringUseCase(login), es, {
      syncProgress: sync,
      gameIds: GAMES,
    });
  }

  it('should_sync_the_progress_of_each_game_when_the_sign_in_or_the_sign_up_succeeds', async () => {
    const sync = new SyncingUseCase();
    const presenter = syncingPresenter([Result.success(SESSION)], [Result.success(SESSION)], sync);

    await presenter.onLogin(ADA);
    await presenter.onRegister(ADA);

    expect(sync.requests.map(({ gameId }) => GAMES.findIndex((id) => id.equals(gameId)))).toEqual([
      0, 1, 0, 1,
    ]);
    expect(presenter.viewModel()).toEqual({ ...formOf(), signedIn: 'Sesión iniciada como ada' });
  });

  it('should_sync_nothing_when_the_sign_in_fails', async () => {
    const sync = new SyncingUseCase();
    const presenter = syncingPresenter([failure(FailureCode.wrongCredentials)], [], sync);

    await presenter.onLogin(ADA);

    expect(sync.requests).toEqual([]);
  });

  it('should_keep_the_signed_in_text_when_the_sync_after_the_sign_in_fails_another_way', async () => {
    const sync = new SyncingUseCase(
      Result.failure(new UseCaseError(FailureCode.backendUnreachable, 'No answer.')),
    );
    const presenter = syncingPresenter([Result.success(SESSION)], [], sync);

    await presenter.onLogin(ADA);

    expect(presenter.viewModel()).toEqual({ ...formOf(), signedIn: 'Sesión iniciada como ada' });
  });

  // `SyncProgress` cleared the session, so the player must sign in again. The sync stops there.
  it('should_show_the_text_of_an_expired_session_when_the_sync_after_the_sign_in_gives_session_expired', async () => {
    const sync = new SyncingUseCase(
      Result.failure(
        new UseCaseError(FailureCode.sessionExpired, 'POST /v1/progress answered 401.'),
      ),
    );
    const presenter = syncingPresenter([Result.success(SESSION)], [], sync);

    await presenter.onLogin(ADA);

    expect(presenter.viewModel()).toEqual({
      ...formOf(),
      error: es['account.error.session-expired'],
    });
    expect(sync.requests).toHaveLength(1);
  });
});
