import type { Credentials } from '../../application/ports/credentials';
import type { Leaderboard, LeaderboardRow } from '../../application/ports/leaderboard';
import { Session } from '../../application/ports/session';
import { GameProgress } from '../../domain/progress/game-progress';
import { LevelId } from '../../domain/progress/level-id';
import { ProgressRecord } from '../../domain/progress/progress-model';
import { Stars } from '../../domain/progress/stars';
import { ElapsedTime } from '../../domain/shared/elapsed-time';
import { GameId } from '../../domain/shared/game-id';
import { Moves } from '../../domain/shared/moves';
import { Score } from '../../domain/shared/score';
import { onlyValue, valueOf } from '../delivered';
import type { CredentialsDto, CurrentUserDto, TokenDto } from './account-api';
import type {
  GlobalLeaderboardDto,
  LevelEntryDto,
  LevelLeaderboardDto,
  ScoreEntryDto,
  StandingEntryDto,
} from './leaderboard-api';
import type { LevelResultDto, ProgressDto, SyncProgressDto } from './progress-api';

// The DTO mapper of the HTTP adapters (classes.md decision 22, view 4.2, #45). It turns the
// values of layer 2 into the DTOs of hexablock-api and the DTOs into values of layer 2, so no
// adapter copies a field by hand. #46, #47 and #48 add the mappings of their resources here.
// It reads each value of the domain with the helpers of `delivered.ts` (rule R-no-delivery-call).
export class ApiDtoMapper {
  // The body of a sign-up or a sign-in. The sign-in body has the same fields.
  toCredentialsDto(credentials: Credentials): CredentialsDto {
    return { username: credentials.username, password: credentials.password };
  }

  // The session of the token of a sign-in and of the account of that token.
  // A blank token or user id throws the `RangeError` of `Session`.
  toSession(token: TokenDto, user: CurrentUserDto): Session {
    return new Session(token.accessToken, user.userId);
  }

  // The body of the sync of `progress` (#46, DS-5): the game, the high score when the progress
  // keeps one, and the result of each level when the progress keeps one.
  // The backend asks for the stars, the moves and the time of each result. Sort saved its results
  // with no time before #46, so a result with no moves or no time stays out of the body and stays
  // local. The backend keeps no score per level, so a level result sends no score.
  toSyncProgressDto(progress: GameProgress): SyncProgressDto {
    return onlyValue<SyncProgressDto>((keep) =>
      progress.deliverTo({
        receive: (gameId, highScore, levels) => {
          const results = levels.flatMap(levelResultOf);
          keep({
            gameId: valueOf(gameId),
            ...(highScore === undefined ? {} : { score: highScoreOf(highScore) }),
            ...(results.length === 0 ? {} : { results }),
          });
        },
      }),
    );
  }

  // The progress of the answer of a sync (#46). Each factory method checks its value.
  // The backend keeps no score per level (DS-5), so each level result gets the score 0. No reader
  // reads the score of a level result: a level ranks by its stars, its moves and its time (DS-4).
  // A `highScore` of `null` gives a progress with no high score.
  toGameProgress(dto: ProgressDto): GameProgress {
    const gameId = GameId.of(dto.gameId);
    const progress = GameProgress.start(gameId);
    if (dto.highScore !== null) {
      progress.recordScore(ProgressRecord.of({ gameId, score: Score.of(dto.highScore) }));
    }
    for (const result of dto.results) {
      progress.recordLevel(
        ProgressRecord.of({
          gameId,
          score: Score.of(0),
          levelId: LevelId.of(result.levelId),
          stars: Stars.of(result.stars),
          moves: Moves.of(result.moves),
          elapsedMs: ElapsedTime.ofMs(result.elapsedMs),
        }),
      );
    }
    return progress;
  }

  // The global board of one game (#47, S3-03): the rows of the high scores, then the rows of the
  // standings. The backend leaves one of the two lists empty, so the board holds one kind of row.
  // The rows keep the order and the rank of the backend. Each factory method checks its value, so a
  // value out of its range throws a `RangeError`.
  toGlobalLeaderboard(dto: GlobalLeaderboardDto): Leaderboard {
    return { rows: [...dto.highScores.map(scoreRowOf), ...dto.standings.map(standingRowOf)] };
  }

  // The board of one level (#47, DS-4), with the rows in the order of the backend.
  toLevelLeaderboard(dto: LevelLeaderboardDto): Leaderboard {
    return { rows: dto.entries.map(levelRowOf) };
  }
}

// The row of a high score.
function scoreRowOf(entry: ScoreEntryDto): LeaderboardRow {
  return {
    rank: entry.rank,
    username: entry.username,
    record: { kind: 'score', score: Score.of(entry.highScore) },
  };
}

// The row of the totals of the level results of one player.
function standingRowOf(entry: StandingEntryDto): LeaderboardRow {
  return {
    rank: entry.rank,
    username: entry.username,
    record: {
      kind: 'standing',
      stars: Stars.of(entry.stars),
      levelsCompleted: entry.levelsCompleted,
      moves: Moves.of(entry.moves),
      elapsed: ElapsedTime.ofMs(entry.elapsedMs),
    },
  };
}

// The row of the best result of one player on one level.
function levelRowOf(entry: LevelEntryDto): LeaderboardRow {
  return {
    rank: entry.rank,
    username: entry.username,
    record: {
      kind: 'level',
      stars: Stars.of(entry.stars),
      moves: Moves.of(entry.moves),
      elapsed: ElapsedTime.ofMs(entry.elapsedMs),
    },
  };
}

// The number of the high score of a progress.
function highScoreOf(record: ProgressRecord): number {
  return onlyValue<number>((keep) =>
    record.deliverTo({ receive: (_gameId, score) => keep(valueOf(score)) }),
  );
}

// The level result of a record, or none when the record has no level id, no stars, no moves or no
// time.
function levelResultOf(record: ProgressRecord): LevelResultDto[] {
  return onlyValue<LevelResultDto[]>((keep) =>
    record.deliverTo({
      receive: (_gameId, _score, levelId, stars, moves, elapsedMs) =>
        keep(
          levelId === undefined ||
            stars === undefined ||
            moves === undefined ||
            elapsedMs === undefined
            ? []
            : [
                {
                  levelId: valueOf(levelId),
                  stars: valueOf(stars),
                  moves: valueOf(moves),
                  elapsedMs: valueOf(elapsedMs),
                },
              ],
        ),
    }),
  );
}
