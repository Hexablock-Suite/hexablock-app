/** @jest-environment node */
import { GetGlobalLeaderboard } from '../../src/application/leaderboard/get-global-leaderboard';
import { GetLevelLeaderboard } from '../../src/application/leaderboard/get-level-leaderboard';
import type { Leaderboard } from '../../src/application/ports/leaderboard';
import {
  LeaderboardFailure,
  type LeaderboardGateway,
} from '../../src/application/ports/leaderboard-gateway';
import { FailureCode, type Result } from '../../src/application/result';
import { Session } from '../../src/application/ports/session';
import type { SessionStore } from '../../src/application/ports/session-store';
import { LevelId } from '../../src/domain/progress/level-id';
import { Stars } from '../../src/domain/progress/stars';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';

// Issue #47 (APP-FR-14): `GetGlobalLeaderboard` and `GetLevelLeaderboard` read one board of
// hexablock-api through the `LeaderboardGateway` port with the session of the player. Each board
// has its own input port, as hexablock-api#218 decided. The backend ranks the rows (S3-03, DS-4),
// so the use cases keep the rows and their ranks as the gateway gives them.

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');
const FIT_01 = LevelId.of('fit-01');
const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');

// A board of high scores with a shared rank: 1, 1, 3.
const SCORES: Leaderboard = {
  rows: [
    { rank: 1, username: 'ada', record: { kind: 'score', score: Score.of(2048) } },
    { rank: 1, username: 'grace', record: { kind: 'score', score: Score.of(2048) } },
    { rank: 3, username: 'linus', record: { kind: 'score', score: Score.of(512) } },
  ],
};
const LEVEL: Leaderboard = {
  rows: [
    {
      rank: 1,
      username: 'ada',
      record: {
        kind: 'level',
        stars: Stars.of(3),
        moves: Moves.of(10),
        elapsed: ElapsedTime.ofMs(45000),
      },
    },
  ],
};

// A session store in memory that counts its clears. `broken` makes each read throw.
class MemorySessions implements SessionStore {
  clears = 0;
  constructor(
    private session: Session | undefined,
    private readonly broken = false,
  ) {}
  read(): Promise<Session | undefined> {
    if (this.broken) return Promise.reject(new Error('The secure storage is locked.'));
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
    this.session = undefined;
    return Promise.resolve();
  }
}

// A gateway that records each call and gives its board, or rejects with `failure`.
class FakeGateway implements LeaderboardGateway {
  readonly calls: string[] = [];
  constructor(private readonly failure?: unknown) {}
  globalBoard(session: Session, gameId: GameId): Promise<Leaderboard> {
    this.calls.push(`global ${session.token} ${gameId.equals(LINES) ? 'hexa-lines' : 'other'}`);
    return this.failure === undefined ? Promise.resolve(SCORES) : Promise.reject(this.failure);
  }
  levelBoard(session: Session, gameId: GameId, levelId: LevelId): Promise<Leaderboard> {
    const names = `${gameId.equals(FIT) ? 'hexa-fit' : 'other'} ${levelId.equals(FIT_01) ? 'fit-01' : 'other'}`;
    this.calls.push(`level ${session.token} ${names}`);
    return this.failure === undefined ? Promise.resolve(LEVEL) : Promise.reject(this.failure);
  }
}

// Each board through its own use case, over one store and one gateway.
function boards(sessions: SessionStore, gateway: LeaderboardGateway) {
  return [
    {
      name: 'global',
      read: () => new GetGlobalLeaderboard(sessions, gateway).execute({ gameId: LINES }),
    },
    {
      name: 'level',
      read: () =>
        new GetLevelLeaderboard(sessions, gateway).execute({ gameId: FIT, levelId: FIT_01 }),
    },
  ];
}

// The code of a failed `Result`. A success fails the test.
function codeOf(result: Result<Leaderboard>): string {
  if (result.ok) throw new Error('The use case did not fail.');
  return result.error.code;
}

describe('GetGlobalLeaderboard and GetLevelLeaderboard', () => {
  it('should_give_the_rows_of_the_game_board_with_their_shared_ranks_when_a_signed_in_player_asks_for_it', async () => {
    const gateway = new FakeGateway();

    const result = await new GetGlobalLeaderboard(new MemorySessions(ADA), gateway).execute({
      gameId: LINES,
    });

    expect(result).toEqual({ ok: true, value: SCORES });
    expect(gateway.calls).toEqual(['global token-of-ada hexa-lines']);
  });

  it('should_give_the_rows_of_the_level_board_when_a_signed_in_player_asks_for_it', async () => {
    const gateway = new FakeGateway();

    const result = await new GetLevelLeaderboard(new MemorySessions(ADA), gateway).execute({
      gameId: FIT,
      levelId: FIT_01,
    });

    expect(result).toEqual({ ok: true, value: LEVEL });
    expect(gateway.calls).toEqual(['level token-of-ada hexa-fit fit-01']);
  });

  it.each(['global', 'level'])(
    'should_fail_with_sign_in_required_and_call_no_backend_when_no_player_signed_in',
    async (board) => {
      const gateway = new FakeGateway();
      const sessions = new MemorySessions(undefined);

      const result = await boards(sessions, gateway)
        .find(({ name }) => name === board)!
        .read();

      expect(codeOf(result)).toBe(FailureCode.signInRequired);
      expect(gateway.calls).toEqual([]);
      expect(sessions.clears).toBe(0);
    },
  );

  it.each(['global', 'level'])(
    'should_clear_the_session_and_fail_with_session_expired_when_the_backend_refuses_the_token',
    async (board) => {
      const sessions = new MemorySessions(ADA);
      const gateway = new FakeGateway(
        new LeaderboardFailure(FailureCode.sessionExpired, 'GET answered 401.'),
      );

      const result = await boards(sessions, gateway)
        .find(({ name }) => name === board)!
        .read();

      expect(codeOf(result)).toBe(FailureCode.sessionExpired);
      expect(sessions.clears).toBe(1);
      await expect(sessions.read()).resolves.toBeUndefined();
    },
  );

  it('should_fail_with_level_has_no_board_and_keep_the_session_when_the_backend_holds_no_board_of_the_level', async () => {
    const sessions = new MemorySessions(ADA);
    const gateway = new FakeGateway(
      new LeaderboardFailure(FailureCode.levelHasNoBoard, 'GET answered 404.'),
    );

    const result = await new GetLevelLeaderboard(sessions, gateway).execute({
      gameId: FIT,
      levelId: FIT_01,
    });

    expect(codeOf(result)).toBe(FailureCode.levelHasNoBoard);
    expect(sessions.clears).toBe(0);
  });

  it.each(['global', 'level'])(
    'should_fail_with_backend_unreachable_and_keep_the_session_when_the_backend_gives_no_answer',
    async (board) => {
      const sessions = new MemorySessions(ADA);
      const gateway = new FakeGateway(
        new LeaderboardFailure(FailureCode.backendUnreachable, 'GET got no answer.'),
      );

      const result = await boards(sessions, gateway)
        .find(({ name }) => name === board)!
        .read();

      expect(codeOf(result)).toBe(FailureCode.backendUnreachable);
      expect(sessions.clears).toBe(0);
    },
  );

  it.each(['global', 'level'])(
    'should_fail_with_leaderboard_failed_and_keep_the_cause_when_the_gateway_throws_another_value',
    async (board) => {
      const thrown = new RangeError('A score needs a whole number of 0 or more, not -1.');
      const sessions = new MemorySessions(ADA);

      const result = await boards(sessions, new FakeGateway(thrown))
        .find(({ name }) => name === board)!
        .read();

      expect(codeOf(result)).toBe(FailureCode.leaderboardFailed);
      expect(result.ok ? undefined : result.error.cause).toBe(thrown);
      expect(sessions.clears).toBe(0);
    },
  );

  it.each(['global', 'level'])(
    'should_fail_with_leaderboard_failed_and_call_no_backend_when_the_session_cannot_be_read',
    async (board) => {
      const gateway = new FakeGateway();

      const result = await boards(new MemorySessions(ADA, true), gateway)
        .find(({ name }) => name === board)!
        .read();

      expect(codeOf(result)).toBe(FailureCode.leaderboardFailed);
      expect(gateway.calls).toEqual([]);
    },
  );
});
