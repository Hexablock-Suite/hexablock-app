import type { LevelId } from '../../domain/progress/level-id';
import type { GameId } from '../../domain/shared/game-id';
import type { Leaderboard } from './leaderboard';
import type { FailureCode } from '../result';
import type { Session } from './session';

// The failure codes of a board that the backend gives, or that its silence gives (issue #47).
// `session-expired` names a token that the backend refuses: it lives 24 hours and has no refresh.
// `level-has-no-board` names a level that the level definitions of the backend do not hold.
export type LeaderboardFailureCode =
  | typeof FailureCode.sessionExpired
  | typeof FailureCode.backendUnreachable
  | typeof FailureCode.levelHasNoBoard;

// The error that a `LeaderboardGateway` throws for a known failure (APP-FR-14). `code` is the
// failure code of the use case. Any other thrown value is a failure of the gateway itself.
export class LeaderboardFailure extends Error {
  constructor(
    readonly code: LeaderboardFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'LeaderboardFailure';
  }
}

// Output port of the leaderboards (APP-FR-14, issue #47, classes.md decision 67).
// `GetGlobalLeaderboard` and `GetLevelLeaderboard` read the boards of the backend through it.
// `ApiLeaderboardGateway` of layer 3, `src/adapters/api/`, implements it (decision 22).
// Each method sends the token of `session`, because the backend guards both boards.
// A known failure throws a `LeaderboardFailure`.
export interface LeaderboardGateway {
  // The global board of the game `gameId`, with the rows in the order of the backend (S3-03).
  globalBoard(session: Session, gameId: GameId): Promise<Leaderboard>;
  // The board of the level `levelId` of the game `gameId`, with the rows in the order of the
  // backend (DS-4). A level that the backend does not hold throws `level-has-no-board`.
  levelBoard(session: Session, gameId: GameId, levelId: LevelId): Promise<Leaderboard>;
}
