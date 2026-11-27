import type { GameId } from '../domain/shared/game-id';
import type { GameProgress } from '../domain/progress/game-progress';
import type { ProgressRepository } from './progress-repository';
import { caughtError, FailureCode, Result } from './result';
import type { UseCase } from './use-case';

// The request of `LoadProgress`. It has no member: the use case reads the saved progress
// of the game of its constructor, as `ListAchievements` reads the games of its goals.
export type LoadProgressRequest = Readonly<Record<string, never>>;

// Reads the saved progress of one game from the device (APP-FR-04, S3-16 in #151, issue #181).
// It loads the `GameProgress` of the game through the `ProgressRepository` port and returns
// it as it is: `undefined` when the game has no saved progress. It writes nothing, and it
// never starts a progress: the answer of a game without one is no progress (decision 56).
// The composition root gives `gameId`, the id of the game to read, as it gives the id of a
// game to `SaveProgress` (decision 40). One `LoadProgress` reads one game.
// No exception leaves `execute()`. A port that throws gives a `load-failed` failure.
export class LoadProgress implements UseCase<LoadProgressRequest, GameProgress | undefined> {
  constructor(
    private readonly repository: ProgressRepository,
    private readonly gameId: GameId,
  ) {}

  async execute(_request: LoadProgressRequest): Promise<Result<GameProgress | undefined>> {
    try {
      return Result.success(await this.repository.load(this.gameId));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.loadFailed, thrown));
    }
  }
}
