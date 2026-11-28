import type { Stars } from '../../domain/progress/stars';
import type { ElapsedTime } from '../../domain/shared/elapsed-time';
import type { Moves } from '../../domain/shared/moves';
import type { Score } from '../../domain/shared/score';
import { LeaderboardFailure } from './leaderboard-gateway';
import { caughtError, FailureCode, Result, UseCaseError } from '../result';
import type { Session } from './session';
import type { SessionStore } from './session-store';

// The record of one row. `kind` tells the three records apart:
// - `score`: the high score of the player on the board of a game that keeps a score, Lines and
//   Merge (S3-03).
// - `standing`: the totals of the level results of the player on the board of a game with levels,
//   Fit and Sort (S3-03). `levelsCompleted` is the number of levels with a result.
// - `level`: the best result of the player on the board of one level (DS-4).
export type LeaderboardRecord =
  | { readonly kind: 'score'; readonly score: Score }
  | {
      readonly kind: 'standing';
      readonly stars: Stars;
      readonly levelsCompleted: number;
      readonly moves: Moves;
      readonly elapsed: ElapsedTime;
    }
  | {
      readonly kind: 'level';
      readonly stars: Stars;
      readonly moves: Moves;
      readonly elapsed: ElapsedTime;
    };

// One row of a board (APP-FR-14). `rank` is the rank that the backend gives: a full tie shares a
// rank, and the next rank skips (1, 1, 3). `username` is the name of the account (hexablock-api#230).
export interface LeaderboardRow {
  readonly rank: number;
  readonly username: string;
  readonly record: LeaderboardRecord;
}

// One board of hexablock-api (APP-FR-14, issue #47, classes.md decision 67). It is the plain
// response model of `GetGlobalLeaderboard` and `GetLevelLeaderboard`. The backend ranks the rows
// (S3-03, DS-4), so the rows keep the order and the ranks of the backend. The app never sorts
// them and never computes a rank.
export interface Leaderboard {
  readonly rows: readonly LeaderboardRow[];
}

// The text of the failure of a board with no session.
const NO_SESSION = 'A board needs a signed-in player.';

// The rule of both leaderboard use cases (#47). A board needs a signed-in player, because the
// backend guards both routes with a token. The function reads the session once:
// - With no session it gives `sign-in-required` and calls no backend.
// - With a session it reads the board through `read` with that session.
// A `LeaderboardFailure` gives its code. `session-expired` also clears the session through
// `SessionStore.clear()`, which keeps the owner of the progress (decision 66), so the screen asks
// the player to sign in. A session that cannot be read and any other thrown value give
// `leaderboard-failed`. A clear that throws still gives `session-expired`.
// No exception leaves the function (decision 28).
export async function readBoard(
  sessions: SessionStore,
  read: (session: Session) => Promise<Leaderboard>,
): Promise<Result<Leaderboard>> {
  let session: Session | undefined;
  try {
    session = await sessions.read();
  } catch (thrown) {
    return Result.failure(caughtError(FailureCode.leaderboardFailed, thrown));
  }
  if (session === undefined) {
    return Result.failure(new UseCaseError(FailureCode.signInRequired, NO_SESSION));
  }
  try {
    return Result.success(await read(session));
  } catch (thrown) {
    return failureOf(sessions, thrown);
  }
}

// The failure of a thrown value. A refused token also clears the session.
async function failureOf(sessions: SessionStore, thrown: unknown): Promise<Result<Leaderboard>> {
  if (!(thrown instanceof LeaderboardFailure)) {
    return Result.failure(caughtError(FailureCode.leaderboardFailed, thrown));
  }
  if (thrown.code === FailureCode.sessionExpired) {
    try {
      await sessions.clear();
    } catch {
      // The token stays. The backend refuses it again at the next request.
    }
  }
  return Result.failure(new UseCaseError(thrown.code, thrown.message, false, thrown));
}
