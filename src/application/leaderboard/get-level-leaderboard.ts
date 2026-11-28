import type { LevelId } from '../../domain/progress/level-id';
import type { GameId } from '../../domain/shared/game-id';
import { readBoard, type Leaderboard } from '../ports/leaderboard';
import type { LeaderboardGateway } from '../ports/leaderboard-gateway';
import type { Result } from '../result';
import type { SessionStore } from '../ports/session-store';
import type { UseCase } from '../use-case';

// The request of `GetLevelLeaderboard`: the game and the level of the board.
export interface LevelLeaderboardRequest {
  readonly gameId: GameId;
  readonly levelId: LevelId;
}

// Reads the board of one level of Fit or Sort from the backend (APP-FR-14, DS-4, issue #47,
// classes.md decision 67). The board of a level has its own input port, as hexablock-api#218
// decided. A level that the backend does not hold gives `level-has-no-board`.
// It reads the session through `SessionStore` for the token, and the board through the
// `LeaderboardGateway` port. `readBoard()` holds the failures, which both boards share.
// `SessionAspect` requires the session and clears a refused one (#481), so the use case never clears it.
// No exception leaves `execute()` (decision 28).
export class GetLevelLeaderboard implements UseCase<LevelLeaderboardRequest, Leaderboard> {
  constructor(
    private readonly sessions: SessionStore,
    private readonly gateway: LeaderboardGateway,
  ) {}

  execute(request: LevelLeaderboardRequest): Promise<Result<Leaderboard>> {
    return readBoard(this.sessions, (session) =>
      this.gateway.levelBoard(session, request.gameId, request.levelId),
    );
  }
}
