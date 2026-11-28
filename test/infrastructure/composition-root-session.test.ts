/** @jest-environment node */
import type { AccountApi } from '../../src/adapters/api/account-api';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import type { LeaderboardApi } from '../../src/adapters/api/leaderboard-api';
import type { LevelsApi } from '../../src/adapters/api/levels-api';
import type { ProgressApi } from '../../src/adapters/api/progress-api';
import { SessionManager } from '../../src/adapters/session-manager';
import { Session } from '../../src/application/ports/session';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameId } from '../../src/domain/shared/game-id';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import { RecordingLogger } from '../support/application/recording-logger';
import { ManualClock } from '../support/engine/manual-clock';

// Issue #481: the root wraps both leaderboard use cases in `SessionAspect`, inside
// `LoggingAspect`. So a call that the session rejects still leaves its entry in the log
// (APP-NFR-11, row «Log each call, rejected calls included» of docs/REQUIREMENTS.md).

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');
const FIT_01 = LevelId.of('fit-01');
const ADA = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

// A backend whose boards answer with `answer` and record each call.
function backendOf(calls: string[], answer: (call: string) => Promise<never> | undefined) {
  const api: AccountApi & ProgressApi & LeaderboardApi & LevelsApi = {
    getLevels: () => Promise.resolve({ levels: [] }),
    signUp: () => Promise.resolve(),
    signIn: () => Promise.resolve({ accessToken: 'token-of-ada' }),
    currentUser: () => Promise.resolve({ userId: ADA }),
    syncProgress: (_token, body) =>
      Promise.resolve({ gameId: body.gameId, highScore: null, updatedAt: '', results: [] }),
    globalLeaderboard: (token, gameId) => {
      const call = `global ${token} ${gameId}`;
      calls.push(call);
      return answer(call) ?? Promise.resolve({ gameId, highScores: [], standings: [] });
    },
    levelLeaderboard: (token, gameId, levelId) => {
      const call = `level ${token} ${gameId} ${levelId}`;
      calls.push(call);
      return answer(call) ?? Promise.resolve({ gameId, levelId, entries: [] });
    },
  };
  return api;
}

// The use case, the outcome and the failure code of each entry of the log.
function entriesOf(logger: RecordingLogger): string[] {
  return logger.entries.map(
    ({ useCase, outcome, error }) => `${useCase} ${outcome} ${error?.code ?? '-'}`,
  );
}

describe('CompositionRoot session', () => {
  it('should_fail_with_sign_in_required_call_no_backend_and_log_each_call_when_a_board_is_read_with_no_session', async () => {
    const calls: string[] = [];
    const logger = new RecordingLogger();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      api: backendOf(calls, () => undefined),
      secrets: new InMemorySecretStore(),
    });
    const global = root.leaderboardPresenter(LINES);
    const level = root.leaderboardPresenter(FIT, FIT_01);

    await global.onOpen();
    await level.onOpen();

    expect(calls).toEqual([]);
    expect(entriesOf(logger)).toEqual([
      'GetGlobalLeaderboard failure sign-in-required',
      'GetLevelLeaderboard failure sign-in-required',
    ]);
    expect(global.viewModel().signIn).toBe('Iniciar sesión');
    expect(level.viewModel().signIn).toBe('Iniciar sesión');
  });

  it('should_clear_the_token_keep_the_owner_and_log_session_expired_when_the_backend_refuses_the_token_of_a_board', async () => {
    const calls: string[] = [];
    const logger = new RecordingLogger();
    const secrets = new InMemorySecretStore();
    const sessions = new SessionManager(secrets);
    await sessions.write(new Session('token-of-ada', ADA));
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      api: backendOf(calls, (call) => Promise.reject(new ApiFailure(401, `${call} answered 401.`))),
      secrets,
    });
    const global = root.leaderboardPresenter(LINES);
    const level = root.leaderboardPresenter(FIT, FIT_01);

    await global.onOpen();
    await level.onOpen();

    expect(calls).toEqual(['global token-of-ada hexa-lines']);
    expect(entriesOf(logger)).toEqual([
      'GetGlobalLeaderboard failure session-expired',
      'GetLevelLeaderboard failure sign-in-required',
    ]);
    await expect(sessions.read()).resolves.toBeUndefined();
    await expect(sessions.owner()).resolves.toBe(ADA);
    expect(global.viewModel().signIn).toBe('Iniciar sesión');
  });
});
