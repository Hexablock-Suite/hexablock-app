import {
  AccountFailure,
  type AccountFailureCode,
  type AccountGateway,
} from '../../src/application/ports/account-gateway';
import type { Credentials } from '../../src/application/ports/credentials';
import { Login } from '../../src/application/account/login';
import { Register } from '../../src/application/account/register';
import { FailureCode, type Result } from '../../src/application/result';
import { Session } from '../../src/application/ports/session';
import type { SessionStore } from '../../src/application/ports/session-store';
import type { UseCase } from '../../src/application/use-case';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { GameId } from '../../src/domain/shared/game-id';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';

// APP-FR-12 (#45): the player signs up and signs in, and the app keeps the session.

const ADA: Credentials = { username: 'ada', password: 'correct horse battery' };
const SESSION = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');

// A session store that keeps the written sessions in memory. `failing` makes each write reject.
class KeptSessions implements SessionStore {
  readonly written: Session[] = [];

  constructor(private readonly failing = false) {}

  read(): Promise<Session | undefined> {
    return Promise.resolve(this.written.at(-1));
  }

  owner(): Promise<string | undefined> {
    return Promise.resolve(this.written.at(-1)?.userId);
  }

  write(session: Session): Promise<void> {
    if (this.failing) return Promise.reject(new Error('The secure storage is locked.'));
    this.written.push(session);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.written.length = 0;
    return Promise.resolve();
  }
}

// A gateway whose two operations give `answer` and record each call.
function gatewayOf(answer: () => Promise<Session>): AccountGateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    register: (credentials) => {
      calls.push(`register ${credentials.username}`);
      return answer();
    },
    login: (credentials) => {
      calls.push(`login ${credentials.username}`);
      return answer();
    },
  };
}

const codeOf = (result: Result<Session>) => (result.ok ? undefined : result.error.code);

describe('Session', () => {
  it('should_keep_the_token_and_the_user_id_when_both_are_given', () => {
    expect(SESSION.token).toBe('token-of-ada');
    expect(SESSION.userId).toBe('0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
    expect(Object.isFrozen(SESSION)).toBe(true);
  });

  it('should_throw_a_range_error_when_the_token_or_the_user_id_is_blank', () => {
    expect(() => new Session(' ', 'user')).toThrow(new RangeError('A session needs a token.'));
    expect(() => new Session('token', '')).toThrow(new RangeError('A session needs a user id.'));
  });
});

// Register and Login share their rule: each one asks its operation of the gateway for the
// session and keeps it. Each one has its own failure code for an unknown failure.
describe.each([
  {
    name: 'Login',
    make: (accounts: AccountGateway, sessions: SessionStore) => new Login(accounts, sessions),
    call: 'login ada',
    failed: FailureCode.loginFailed,
  },
  {
    name: 'Register',
    make: (accounts: AccountGateway, sessions: SessionStore) => new Register(accounts, sessions),
    call: 'register ada',
    failed: FailureCode.registerFailed,
  },
])('$name', ({ make, call, failed }) => {
  const useCaseOf = (
    accounts: AccountGateway,
    sessions: SessionStore,
  ): UseCase<Credentials, Session> => make(accounts, sessions);

  it('should_keep_the_session_and_give_it_when_the_gateway_gives_one', async () => {
    const accounts = gatewayOf(() => Promise.resolve(SESSION));
    const sessions = new KeptSessions();

    const result = await useCaseOf(accounts, sessions).execute(ADA);

    expect(result).toEqual({ ok: true, value: SESSION });
    expect(accounts.calls).toEqual([call]);
    expect(sessions.written).toEqual([SESSION]);
  });

  it.each<AccountFailureCode>([
    FailureCode.usernameTaken,
    FailureCode.wrongCredentials,
    FailureCode.invalidCredentials,
    FailureCode.backendUnreachable,
  ])(
    'should_give_the_code_of_the_failure_and_keep_no_session_when_the_gateway_throws_an_account_failure',
    async (code) => {
      const sessions = new KeptSessions();
      const refusal = new AccountFailure(code, 'POST /v1/auth/login answered 401.');

      const result = await useCaseOf(
        gatewayOf(() => Promise.reject(refusal)),
        sessions,
      ).execute(ADA);

      expect(codeOf(result)).toBe(code);
      expect(result.ok ? undefined : result.error.cause).toBe(refusal);
      expect(sessions.written).toEqual([]);
    },
  );

  it('should_give_its_own_failure_code_and_keep_no_session_when_the_gateway_throws_another_error', async () => {
    const sessions = new KeptSessions();

    const result = await useCaseOf(
      gatewayOf(() => Promise.reject(new Error('GET /v1/auth/me answered 500.'))),
      sessions,
    ).execute(ADA);

    expect(codeOf(result)).toBe(failed);
    expect(result.ok ? undefined : result.error.message).toBe('GET /v1/auth/me answered 500.');
    expect(sessions.written).toEqual([]);
  });

  it('should_give_its_own_failure_code_when_the_session_store_cannot_keep_the_session', async () => {
    const result = await useCaseOf(
      gatewayOf(() => Promise.resolve(SESSION)),
      new KeptSessions(true),
    ).execute(ADA);

    expect(codeOf(result)).toBe(failed);
    expect(result.ok ? undefined : result.error.message).toBe('The secure storage is locked.');
  });
});

// Judgment-day round 1, F3 and F4: at sign-in the progress played with no account merges into the
// key of the user locally, before any request, and the anonymous key is forgotten only after the
// merged progress is saved.
describe('Login and the progress played with no account', () => {
  const FIT = GameId.of('hexa-fit');
  const ANONYMOUS = '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":3,"moves":3}]}';

  // A store whose writes reject once `failing` is set, as a full disk does.
  class FullDisk extends InMemoryKeyValueStore {
    failing = false;
    override set(key: string, value: string): Promise<void> {
      if (this.failing) return Promise.reject(new Error('The disk is full.'));
      return super.set(key, value);
    }
  }

  it('should_merge_the_anonymous_progress_into_the_key_of_the_user_when_the_player_signs_in', async () => {
    const store = new FullDisk();
    await store.set('progress:hexa-fit', ANONYMOUS);
    const sessions = new KeptSessions();
    const repository = new LocalProgressRepository(store, sessions);

    const result = await new Login(
      gatewayOf(() => Promise.resolve(SESSION)),
      sessions,
      {
        anonymous: repository,
        gameIds: [FIT],
      },
    ).execute(ADA);

    expect(result.ok).toBe(true);
    await expect(store.get(`progress:${SESSION.userId}:hexa-fit`)).resolves.toBe(ANONYMOUS);
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  it('should_keep_the_anonymous_progress_and_give_login_failed_when_the_merged_progress_cannot_be_saved', async () => {
    const store = new FullDisk();
    await store.set('progress:hexa-fit', ANONYMOUS);
    store.failing = true;
    const sessions = new KeptSessions();
    const repository = new LocalProgressRepository(store, sessions);

    const result = await new Login(
      gatewayOf(() => Promise.resolve(SESSION)),
      sessions,
      {
        anonymous: repository,
        gameIds: [FIT],
      },
    ).execute(ADA);

    expect(codeOf(result)).toBe(FailureCode.loginFailed);
    await expect(store.get('progress:hexa-fit')).resolves.toBe(ANONYMOUS);
  });
});
