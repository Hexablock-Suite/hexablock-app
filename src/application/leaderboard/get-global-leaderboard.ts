import type { GameId } from '../../domain/shared/game-id';
import { readBoard, type Leaderboard } from '../ports/leaderboard';
import type { LeaderboardGateway } from '../ports/leaderboard-gateway';
import type { Result } from '../result';
import type { SessionStore } from '../ports/session-store';
import type { UseCase } from '../use-case';

// The request of `GetGlobalLeaderboard`: the game of the board.
export interface GlobalLeaderboardRequest {
  readonly gameId: GameId;
}

// Reads the global board of one game from the backend (APP-FR-14, S3-03, issue #47,
// classes.md decision 67). Lines and Merge rank the high scores. Fit and Sort rank the totals
// of the level results. Each board has its own input port, as hexablock-api#218 decided:
// the board of a level has its own request and its own failure, `level-has-no-board`.
// It reads the session through `SessionStore` for the token, and the board through the
// `LeaderboardGateway` port. `readBoard()` holds the failures, which both boards share.
// `SessionAspect` requires the session and clears a refused one (#481), so the use case never clears it.
// No exception leaves `execute()` (decision 28).
export class GetGlobalLeaderboard implements UseCase<GlobalLeaderboardRequest, Leaderboard> {
  constructor(
    private readonly sessions: SessionStore,
    private readonly gateway: LeaderboardGateway,
  ) {}

  execute(request: GlobalLeaderboardRequest): Promise<Result<Leaderboard>> {
    return readBoard(this.sessions, (session) => this.gateway.globalBoard(session, request.gameId));
  }
}
