import { ApiDtoMapper } from '../../src/adapters/api/api-dto-mapper';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import { ApiLeaderboardGateway } from '../../src/adapters/api/api-leaderboard-gateway';
import type {
  GlobalLeaderboardDto,
  LeaderboardApi,
  LevelLeaderboardDto,
} from '../../src/adapters/api/leaderboard-api';
import { valueOf } from '../../src/adapters/delivered';
import type { Leaderboard, LeaderboardRecord } from '../../src/application/leaderboard';
import { LeaderboardFailure } from '../../src/application/leaderboard-gateway';
import { FailureCode } from '../../src/application/result';
import { Session } from '../../src/application/session';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameId } from '../../src/domain/shared/game-id';

// #47 (APP-FR-14, decision 22): `ApiLeaderboardGateway` reads both boards through the transport
// interface `LeaderboardApi` with the token of the session, and `ApiDtoMapper` turns each
// board DTO into a `Leaderboard`, with the rows and the ranks in the order of the backend.

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');
const FIT_01 = LevelId.of('fit-01');
const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const USER = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

const SCORE_BOARD: GlobalLeaderboardDto = {
  gameId: 'hexa-lines',
  highScores: [
    { rank: 1, userId: USER, username: 'ada', highScore: 2048 },
    { rank: 1, userId: USER, username: 'grace', highScore: 2048 },
    { rank: 3, userId: USER, username: 'linus', highScore: 512 },
  ],
  standings: [],
};
const STANDING_BOARD: GlobalLeaderboardDto = {
  gameId: 'hexa-fit',
  highScores: [],
  standings: [
    {
      rank: 1,
      userId: USER,
      username: 'ada',
      stars: 9,
      levelsCompleted: 3,
      moves: 40,
      elapsedMs: 90000,
    },
  ],
};
const LEVEL_BOARD: LevelLeaderboardDto = {
  gameId: 'hexa-fit',
  levelId: 'fit-01',
  entries: [
    { rank: 1, userId: USER, username: 'ada', stars: 3, moves: 10, elapsedMs: 45000 },
    { rank: 2, userId: USER, username: 'grace', stars: 3, moves: 12, elapsedMs: 45000 },
  ],
};

// A transport that records each call and gives its board, or rejects with `failure`.
class FakeLeaderboardApi implements LeaderboardApi {
  readonly calls: string[] = [];
  constructor(
    private readonly global: GlobalLeaderboardDto = SCORE_BOARD,
    private readonly failure?: unknown,
  ) {}
  globalLeaderboard(token: string, gameId: string): Promise<GlobalLeaderboardDto> {
    this.calls.push(`global ${token} ${gameId}`);
    return this.failure === undefined ? Promise.resolve(this.global) : Promise.reject(this.failure);
  }
  levelLeaderboard(token: string, gameId: string, levelId: string): Promise<LevelLeaderboardDto> {
    this.calls.push(`level ${token} ${gameId} ${levelId}`);
    return this.failure === undefined ? Promise.resolve(LEVEL_BOARD) : Promise.reject(this.failure);
  }
}

const gatewayOver = (api: LeaderboardApi) => new ApiLeaderboardGateway(api, new ApiDtoMapper());

// Each row of `board` as plain numbers, so a test compares the values of the value objects.
function plain(board: Leaderboard) {
  return board.rows.map(({ rank, username, record }) => ({
    rank,
    username,
    ...plainRecord(record),
  }));
}

function plainRecord(record: LeaderboardRecord) {
  switch (record.kind) {
    case 'score':
      return { score: valueOf(record.score) };
    case 'standing':
      return {
        stars: valueOf(record.stars),
        levelsCompleted: record.levelsCompleted,
        moves: valueOf(record.moves),
        elapsedMs: valueOf(record.elapsed),
      };
    case 'level':
      return {
        stars: valueOf(record.stars),
        moves: valueOf(record.moves),
        elapsedMs: valueOf(record.elapsed),
      };
  }
}

// The thrown value of `call`. A call that resolves fails the test.
async function thrownBy(call: Promise<unknown>): Promise<unknown> {
  const thrown = await call.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (thrown === undefined) throw new Error('The call did not reject.');
  return thrown;
}

describe('ApiLeaderboardGateway', () => {
  it('should_send_the_token_and_give_the_high_scores_with_their_shared_ranks_when_the_game_keeps_a_score', async () => {
    const api = new FakeLeaderboardApi();

    const board = await gatewayOver(api).globalBoard(ADA, LINES);

    expect(api.calls).toEqual(['global token-of-ada hexa-lines']);
    expect(board.rows.map(({ record }) => record.kind)).toEqual(['score', 'score', 'score']);
    expect(plain(board)).toEqual([
      { rank: 1, username: 'ada', score: 2048 },
      { rank: 1, username: 'grace', score: 2048 },
      { rank: 3, username: 'linus', score: 512 },
    ]);
  });

  it('should_give_the_standings_when_the_game_has_levels', async () => {
    const board = await gatewayOver(new FakeLeaderboardApi(STANDING_BOARD)).globalBoard(ADA, FIT);

    expect(board.rows.map(({ record }) => record.kind)).toEqual(['standing']);
    expect(plain(board)).toEqual([
      { rank: 1, username: 'ada', stars: 9, levelsCompleted: 3, moves: 40, elapsedMs: 90000 },
    ]);
  });

  it('should_send_the_token_the_game_and_the_level_and_give_the_rows_of_the_level_when_a_level_board_is_read', async () => {
    const api = new FakeLeaderboardApi();

    const board = await gatewayOver(api).levelBoard(ADA, FIT, FIT_01);

    expect(api.calls).toEqual(['level token-of-ada hexa-fit fit-01']);
    expect(board.rows.map(({ record }) => record.kind)).toEqual(['level', 'level']);
    expect(plain(board)).toEqual([
      { rank: 1, username: 'ada', stars: 3, moves: 10, elapsedMs: 45000 },
      { rank: 2, username: 'grace', stars: 3, moves: 12, elapsedMs: 45000 },
    ]);
  });

  it('should_give_no_row_when_the_backend_answers_an_empty_board', async () => {
    const empty: GlobalLeaderboardDto = { gameId: 'hexa-lines', highScores: [], standings: [] };

    const board = await gatewayOver(new FakeLeaderboardApi(empty)).globalBoard(ADA, LINES);

    expect(board.rows).toEqual([]);
  });

  it.each([
    { board: 'global', read: (api: LeaderboardApi) => gatewayOver(api).globalBoard(ADA, LINES) },
    {
      board: 'level',
      read: (api: LeaderboardApi) => gatewayOver(api).levelBoard(ADA, FIT, FIT_01),
    },
  ])('should_throw_the_session_expired_failure_when_the_backend_answers_401', async ({ read }) => {
    const thrown = await thrownBy(
      read(new FakeLeaderboardApi(SCORE_BOARD, new ApiFailure(401, 'GET answered 401.'))),
    );

    expect(thrown).toBeInstanceOf(LeaderboardFailure);
    expect((thrown as LeaderboardFailure).code).toBe(FailureCode.sessionExpired);
  });

  it.each([
    { board: 'global', read: (api: LeaderboardApi) => gatewayOver(api).globalBoard(ADA, LINES) },
    {
      board: 'level',
      read: (api: LeaderboardApi) => gatewayOver(api).levelBoard(ADA, FIT, FIT_01),
    },
  ])(
    'should_throw_the_backend_unreachable_failure_when_the_call_gets_no_answer',
    async ({ read }) => {
      const thrown = await thrownBy(
        read(new FakeLeaderboardApi(SCORE_BOARD, new ApiFailure(undefined, 'GET got no answer.'))),
      );

      expect((thrown as LeaderboardFailure).code).toBe(FailureCode.backendUnreachable);
    },
  );

  it('should_throw_the_level_has_no_board_failure_when_the_backend_answers_404_for_a_level', async () => {
    const api = new FakeLeaderboardApi(SCORE_BOARD, new ApiFailure(404, 'GET answered 404.'));

    const thrown = await thrownBy(gatewayOver(api).levelBoard(ADA, FIT, FIT_01));

    expect(thrown).toBeInstanceOf(LeaderboardFailure);
    expect((thrown as LeaderboardFailure).code).toBe(FailureCode.levelHasNoBoard);
  });

  // Only the board of a level has a 404 in the OpenAPI document. Any other status goes on as it is.
  it.each([
    { status: 404, read: (api: LeaderboardApi) => gatewayOver(api).globalBoard(ADA, LINES) },
    { status: 500, read: (api: LeaderboardApi) => gatewayOver(api).levelBoard(ADA, FIT, FIT_01) },
  ])(
    'should_throw_the_api_failure_as_it_is_when_the_backend_answers_another_status',
    async ({ status, read }) => {
      const failure = new ApiFailure(status, `GET answered ${status}.`);

      await expect(read(new FakeLeaderboardApi(SCORE_BOARD, failure))).rejects.toBe(failure);
    },
  );

  it('should_throw_a_range_error_when_a_row_of_the_backend_breaks_the_rule_of_its_value', async () => {
    const broken: GlobalLeaderboardDto = {
      ...SCORE_BOARD,
      highScores: [{ rank: 1, userId: USER, username: 'ada', highScore: -1 }],
    };

    await expect(
      gatewayOver(new FakeLeaderboardApi(broken)).globalBoard(ADA, LINES),
    ).rejects.toThrow(RangeError);
  });
});
