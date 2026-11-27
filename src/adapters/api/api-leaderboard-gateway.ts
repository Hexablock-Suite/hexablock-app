import type { Leaderboard } from '../../application/leaderboard';
import { LeaderboardFailure, type LeaderboardGateway } from '../../application/leaderboard-gateway';
import { FailureCode } from '../../application/result';
import type { Session } from '../../application/session';
import type { LevelId } from '../../domain/progress/level-id';
import type { GameId } from '../../domain/shared/game-id';
import { valueOf } from '../delivered';
import type { ApiDtoMapper } from './api-dto-mapper';
import { ApiFailure } from './api-failure';
import type { LeaderboardApi } from './leaderboard-api';

// Adapter of the `LeaderboardGateway` port over hexablock-api (APP-FR-14, issue #47, classes.md
// decisions 22 and 67). It lives in layer 3, `src/adapters/api/`, and calls the backend through
// the transport interface `LeaderboardApi`, which `ApiClient` of layer 4 implements.
// `ApiDtoMapper` builds the `Leaderboard` of each answer. Each call sends the token of the
// session: `GET /v1/leaderboard/{gameId}` and `GET /v1/leaderboard/{gameId}/levels/{levelId}`.
// A 401 throws the `LeaderboardFailure` of `session-expired`, a call with no answer throws the
// one of `backend-unreachable`, and a 404 of the board of a level throws the one of
// `level-has-no-board`. Any other failure goes on as it is, and the use case gives
// `leaderboard-failed`.
export class ApiLeaderboardGateway implements LeaderboardGateway {
  constructor(
    private readonly api: LeaderboardApi,
    private readonly mapper: ApiDtoMapper,
  ) {}

  async globalBoard(session: Session, gameId: GameId): Promise<Leaderboard> {
    const answer = await answerOf(
      () => this.api.globalLeaderboard(session.token, valueOf(gameId)),
      false,
    );
    return this.mapper.toGlobalLeaderboard(answer);
  }

  async levelBoard(session: Session, gameId: GameId, levelId: LevelId): Promise<Leaderboard> {
    const answer = await answerOf(
      () => this.api.levelLeaderboard(session.token, valueOf(gameId), valueOf(levelId)),
      true,
    );
    return this.mapper.toLevelLeaderboard(answer);
  }
}

// The answer of `call`. An `ApiFailure` with no status throws the `LeaderboardFailure` of
// `backend-unreachable`, and one of status 401 the failure of `session-expired`. With
// `ofLevel`, one of status 404 throws the failure of `level-has-no-board`. The failure keeps
// the message of the `ApiFailure`, which names the call and its status only.
async function answerOf<T>(call: () => Promise<T>, ofLevel: boolean): Promise<T> {
  try {
    return await call();
  } catch (thrown) {
    if (!(thrown instanceof ApiFailure)) throw thrown;
    if (thrown.status === undefined) {
      throw new LeaderboardFailure(FailureCode.backendUnreachable, thrown.message);
    }
    if (thrown.status === 401) {
      throw new LeaderboardFailure(FailureCode.sessionExpired, thrown.message);
    }
    if (ofLevel && thrown.status === 404) {
      throw new LeaderboardFailure(FailureCode.levelHasNoBoard, thrown.message);
    }
    throw thrown;
  }
}
