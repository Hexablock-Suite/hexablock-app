/** @jest-environment node */
import { SessionAspect, type SessionNeed } from '../../src/application/aspects/session-aspect';
import { Session } from '../../src/application/ports/session';
import type { SessionStore } from '../../src/application/ports/session-store';
import { FailureCode, Result, UseCaseError } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';

// Issue #481: `SessionAspect` requires a session before a use case that needs one, and it clears
// the session when the backend refuses the token. The app does not authorize: the backend checks
// the token. The leaderboards require a session, and `SyncProgress` does not.

const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const EXPIRED = new UseCaseError(FailureCode.sessionExpired, 'GET answered 401.');
const UNREACHABLE = new UseCaseError(FailureCode.backendUnreachable, 'GET got no answer.');

// A session store in memory that counts its reads and its clears.
// `brokenRead` makes each read throw, and `brokenClear` makes each clear throw.
class MemorySessions implements SessionStore {
  reads = 0;
  clears = 0;
  constructor(
    private session: Session | undefined,
    private readonly broken: { read?: boolean; clear?: boolean } = {},
  ) {}
  read(): Promise<Session | undefined> {
    this.reads += 1;
    if (this.broken.read) return Promise.reject(new Error('The secure storage is locked.'));
    return Promise.resolve(this.session);
  }
  owner(): Promise<string | undefined> {
    return Promise.resolve(this.session?.userId);
  }
  write(session: Session): Promise<void> {
    this.session = session;
    return Promise.resolve();
  }
  clear(): Promise<void> {
    this.clears += 1;
    if (this.broken.clear) return Promise.reject(new Error('The secure storage is locked.'));
    this.session = undefined;
    return Promise.resolve();
  }
}

// A use case that records each request and answers with a fixed `Result`.
class FixedUseCase implements UseCase<string, number> {
  readonly requests: string[] = [];
  constructor(private readonly result: Result<number>) {}
  execute(request: string): Promise<Result<number>> {
    this.requests.push(request);
    return Promise.resolve(this.result);
  }
}

describe('SessionAspect', () => {
  it('should_fail_with_sign_in_required_and_not_run_the_use_case_when_a_session_is_required_and_no_player_signed_in', async () => {
    const useCase = new FixedUseCase(Result.success(7));
    const sessions = new MemorySessions(undefined);

    const result = await new SessionAspect(useCase, sessions, 'required').execute('board');

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.signInRequired);
    expect(useCase.requests).toEqual([]);
    expect(sessions.clears).toBe(0);
  });

  it('should_give_the_result_of_the_use_case_when_a_session_is_required_and_a_player_signed_in', async () => {
    const useCase = new FixedUseCase(Result.success(7));
    const sessions = new MemorySessions(ADA);

    const result = await new SessionAspect(useCase, sessions, 'required').execute('board');

    expect(result).toEqual(Result.success(7));
    expect(useCase.requests).toEqual(['board']);
    expect(sessions.clears).toBe(0);
    await expect(sessions.read()).resolves.toBe(ADA);
  });

  it('should_give_the_result_of_the_use_case_and_read_no_session_when_the_session_is_optional_and_no_player_signed_in', async () => {
    const useCase = new FixedUseCase(Result.success(7));
    const sessions = new MemorySessions(undefined);

    const result = await new SessionAspect(useCase, sessions, 'optional').execute('sync');

    expect(result).toEqual(Result.success(7));
    expect(useCase.requests).toEqual(['sync']);
    expect(sessions.reads).toBe(0);
  });

  it.each<SessionNeed>(['required', 'optional'])(
    'should_clear_the_session_and_keep_session_expired_when_the_use_case_gives_session_expired',
    async (need) => {
      const sessions = new MemorySessions(ADA);

      const result = await new SessionAspect(
        new FixedUseCase(Result.failure(EXPIRED)),
        sessions,
        need,
      ).execute('call');

      expect(result).toEqual(Result.failure(EXPIRED));
      expect(sessions.clears).toBe(1);
      await expect(sessions.read()).resolves.toBeUndefined();
    },
  );

  it.each<SessionNeed>(['required', 'optional'])(
    'should_keep_the_session_when_the_use_case_fails_with_another_code',
    async (need) => {
      const sessions = new MemorySessions(ADA);

      const result = await new SessionAspect(
        new FixedUseCase(Result.failure(UNREACHABLE)),
        sessions,
        need,
      ).execute('call');

      expect(result).toEqual(Result.failure(UNREACHABLE));
      expect(sessions.clears).toBe(0);
      await expect(sessions.read()).resolves.toBe(ADA);
    },
  );

  // The token stays. The backend refuses it again at the next request.
  it('should_keep_session_expired_when_the_clear_of_the_session_throws', async () => {
    const sessions = new MemorySessions(ADA, { clear: true });

    const result = await new SessionAspect(
      new FixedUseCase(Result.failure(EXPIRED)),
      sessions,
      'optional',
    ).execute('call');

    expect(result).toEqual(Result.failure(EXPIRED));
    expect(sessions.clears).toBe(1);
  });

  // The aspect cannot tell whether a player signed in, so the use case reads the session again
  // and gives its own failure.
  it('should_give_the_result_of_the_use_case_when_a_session_is_required_and_the_session_cannot_be_read', async () => {
    const useCase = new FixedUseCase(Result.success(7));

    const result = await new SessionAspect(
      useCase,
      new MemorySessions(ADA, { read: true }),
      'required',
    ).execute('board');

    expect(result).toEqual(Result.success(7));
    expect(useCase.requests).toEqual(['board']);
  });
});
