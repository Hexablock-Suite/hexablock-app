import { ApiDtoMapper } from '../../src/adapters/api/api-dto-mapper';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import { ApiProgressGateway } from '../../src/adapters/api/api-progress-gateway';
import type {
  ProgressApi,
  ProgressDto,
  SyncProgressDto,
} from '../../src/adapters/api/progress-api';
import { SyncFailure } from '../../src/application/progress-gateway';
import { FailureCode } from '../../src/application/result';
import { Session } from '../../src/application/session';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';
import { sameContent } from '../support/engine/progress-content';

// #46 (APP-FR-13, decision 22): `ApiProgressGateway` sends the local progress through the transport
// interface `ProgressApi`, and `ApiDtoMapper` turns the progress into a `SyncProgressDto` and the
// answer `ProgressDto` into a `GameProgress`.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');
const LINES = GameId.of('hexa-lines');
const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const level = (gameId: GameId, id: string, stars: number, moves: number, ms?: number, score = 0) =>
  ProgressRecord.of({
    gameId,
    score: Score.of(score),
    levelId: LevelId.of(id),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ms === undefined ? undefined : ElapsedTime.ofMs(ms),
  });

function progressOf(gameId: GameId, ...records: ProgressRecord[]): GameProgress {
  const progress = GameProgress.start(gameId);
  for (const record of records) progress.recordLevel(record);
  return progress;
}

const EMPTY_ANSWER = (gameId: string): ProgressDto => ({
  gameId,
  highScore: null,
  updatedAt: '2026-11-27T10:00:00.000Z',
  results: [],
});

// A transport that records each call and gives `answer`, or rejects with `failure`.
class FakeProgressApi implements ProgressApi {
  readonly calls: { token: string; body: SyncProgressDto }[] = [];
  constructor(
    private readonly answer?: ProgressDto,
    private readonly failure?: unknown,
  ) {}
  syncProgress(token: string, body: SyncProgressDto): Promise<ProgressDto> {
    this.calls.push({ token, body });
    if (this.failure !== undefined) return Promise.reject(this.failure);
    return Promise.resolve(this.answer ?? EMPTY_ANSWER(body.gameId));
  }
}

const gatewayOver = (api: ProgressApi) => new ApiProgressGateway(api, new ApiDtoMapper());

// The thrown value of `call`. A call that resolves fails the test.
async function thrownBy(call: Promise<unknown>): Promise<unknown> {
  const thrown = await call.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (thrown === undefined) throw new Error('The call did not reject.');
  return thrown;
}

describe('ApiProgressGateway', () => {
  it('should_send_the_token_and_each_level_result_when_a_progress_of_a_game_with_levels_syncs', async () => {
    const api = new FakeProgressApi();

    await gatewayOver(api).sync(
      ADA,
      progressOf(FIT, level(FIT, 'fit-01', 3, 10, 45000, 120), level(FIT, 'fit-02', 1, 40, 9000)),
    );

    expect(api.calls).toEqual([
      {
        token: 'token-of-ada',
        body: {
          gameId: 'hexa-fit',
          results: [
            { levelId: 'fit-01', stars: 3, moves: 10, elapsedMs: 45000 },
            { levelId: 'fit-02', stars: 1, moves: 40, elapsedMs: 9000 },
          ],
        },
      },
    ]);
  });

  it('should_send_the_high_score_and_no_results_when_a_progress_of_a_game_with_no_levels_syncs', async () => {
    const api = new FakeProgressApi();
    const lines = GameProgress.start(LINES);
    lines.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));

    await gatewayOver(api).sync(ADA, lines);

    expect(api.calls[0]?.body).toEqual({ gameId: 'hexa-lines', score: 36 });
  });

  // Sort saved its results with no time before #46. The backend asks for the time (DS-5),
  // so such a result stays local and the rest of the progress still goes.
  it('should_leave_out_a_level_result_with_no_time_when_the_progress_syncs', async () => {
    const api = new FakeProgressApi();

    await gatewayOver(api).sync(
      ADA,
      progressOf(SORT, level(SORT, 'sort-01', 2, 12), level(SORT, 'sort-02', 3, 8, 30000)),
    );

    expect(api.calls[0]?.body).toEqual({
      gameId: 'hexa-sort',
      results: [{ levelId: 'sort-02', stars: 3, moves: 8, elapsedMs: 30000 }],
    });
  });

  // The backend keeps no score per level (DS-5), so a level result of the answer has the score 0.
  it('should_give_the_progress_of_the_answer_when_the_backend_answers_the_sync', async () => {
    const api = new FakeProgressApi({
      gameId: 'hexa-fit',
      highScore: null,
      updatedAt: '2026-11-27T10:00:00.000Z',
      results: [{ levelId: 'fit-01', stars: 3, moves: 10, elapsedMs: 45000 }],
    });
    const lines = new FakeProgressApi({
      gameId: 'hexa-lines',
      highScore: 36,
      updatedAt: '2026-11-27T10:00:00.000Z',
      results: [],
    });

    const fit = await gatewayOver(api).sync(ADA, GameProgress.start(FIT));
    const scored = await gatewayOver(lines).sync(ADA, GameProgress.start(LINES));

    expect(sameContent(fit, progressOf(FIT, level(FIT, 'fit-01', 3, 10, 45000)))).toBe(true);
    const expectedLines = GameProgress.start(LINES);
    expectedLines.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));
    expect(sameContent(scored, expectedLines)).toBe(true);
  });

  it('should_throw_the_sync_failure_of_session_expired_when_the_backend_refuses_the_token', async () => {
    const api = new FakeProgressApi(
      undefined,
      new ApiFailure(401, 'POST /v1/progress answered 401.'),
    );

    const thrown = await thrownBy(gatewayOver(api).sync(ADA, GameProgress.start(FIT)));

    expect(thrown).toBeInstanceOf(SyncFailure);
    expect((thrown as SyncFailure).code).toBe(FailureCode.sessionExpired);
    expect((thrown as SyncFailure).message).toBe('POST /v1/progress answered 401.');
  });

  it('should_throw_the_sync_failure_of_backend_unreachable_when_no_answer_arrives', async () => {
    const api = new FakeProgressApi(
      undefined,
      new ApiFailure(undefined, 'POST /v1/progress got no answer.'),
    );

    const thrown = await thrownBy(gatewayOver(api).sync(ADA, GameProgress.start(FIT)));

    expect(thrown).toBeInstanceOf(SyncFailure);
    expect((thrown as SyncFailure).code).toBe(FailureCode.backendUnreachable);
  });

  // For example `unknown-level`: the backend holds no level of a result (API-FR-02).
  it('should_throw_the_api_failure_as_it_is_when_the_backend_answers_another_status', async () => {
    const failure = new ApiFailure(400, 'POST /v1/progress answered 400.');
    const api = new FakeProgressApi(undefined, failure);

    await expect(gatewayOver(api).sync(ADA, GameProgress.start(FIT))).rejects.toBe(failure);
  });
});
