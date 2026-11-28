import type { GameId } from '../../domain/shared/game-id';
import type { GameProgress } from '../../domain/progress/game-progress';
import type { ProgressRepository } from '../ports/progress-repository';
import { caughtError, FailureCode, Result } from '../result';
import type { UseCase } from '../use-case';

// The request of `LoadProgress`: the game whose saved progress the caller reads (#410).
// The request of `ListLevels` names its game the same way.
export interface LoadProgressRequest {
  readonly gameId: GameId;
}

// Reads the saved progress of one game from the device (APP-FR-04, S3-16 in #151, issue #181).
// It loads the `GameProgress` of the game of the request through the `ProgressRepository` port,
// for the owner of the progress that the port gives (#46),
// and returns it as it is: `undefined` when the game has no saved progress. It writes nothing,
// and it never starts a progress: the answer of a game without one is no progress (decision 56).
// The request names the game, as the request of `ListLevels` does (#410). So one `LoadProgress`
// reads every game, and the composition root builds it once.
// No exception leaves `execute()`. A port that throws gives a `load-failed` failure.
export class LoadProgress implements UseCase<LoadProgressRequest, GameProgress | undefined> {
  constructor(private readonly repository: ProgressRepository) {}

  async execute(request: LoadProgressRequest): Promise<Result<GameProgress | undefined>> {
    try {
      const owner = await this.repository.owner();
      return Result.success(await this.repository.load(owner, request.gameId));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.loadFailed, thrown));
    }
  }
}
