import type { components } from './dto';

// The global board of one game: the high scores and the standings. One of the two lists is
// empty: Lines and Merge keep a score, and Fit and Sort keep level results (S3-03).
export type GlobalLeaderboardDto = components['schemas']['GlobalLeaderboardDto'];
// One row of the high scores.
export type ScoreEntryDto = components['schemas']['ScoreEntryDto'];
// One row of the standings: the totals of the level results of one player.
export type StandingEntryDto = components['schemas']['StandingEntryDto'];
// The board of one level (DS-4).
export type LevelLeaderboardDto = components['schemas']['LevelLeaderboardDto'];
// One row of the board of a level: the best result of one player.
export type LevelEntryDto = components['schemas']['LevelEntryDto'];

// The transport interface of the leaderboard resource (layers.md, classes.md decision 22,
// option A3, #47). Layer 3 owns it, and `createApiClient()` of layer 4 implements it.
// It is not a port: layer 2 does not own it.
// Its methods take and give the DTO types of `dto.d.ts`, never a type of the HTTP library.
// A call that the backend does not answer with success rejects with an `ApiFailure`.
export interface LeaderboardApi {
  // Gives the global board of the game `gameId`. The request sends the bearer token `token`.
  globalLeaderboard(token: string, gameId: string): Promise<GlobalLeaderboardDto>;
  // Gives the board of the level `levelId` of the game `gameId`. The request sends the bearer
  // token `token`. A level that the backend does not hold answers 404.
  levelLeaderboard(token: string, gameId: string, levelId: string): Promise<LevelLeaderboardDto>;
}
