import type { GameId } from '../domain/engine/game-id';
import { GameProgress } from '../domain/engine/game-progress';
import type { GameResult, IProgressModel } from '../domain/engine/progress-model';
import type { ProgressRepository } from './progress-repository';
import { caughtError, FailureCode, Result } from './result';
import type { UseCase } from './use-case';

// Saves the result of a finished game in the local progress of its game
// (APP-FR-09, docs/architecture/flows.md use case 2, issue #164).
// It loads the `GameProgress` of the game through the `ProgressRepository` port,
// or starts one when the game has no saved progress. The progress model of the variant
// records the result in it, and the port saves it. The progress keeps the best result
// by the order of DS-4 and DS-12, so a worse result changes nothing.
// The use case changes one aggregate, the progress, and never the game (decision 52).
// A result keeps its game id private, so the composition root gives `gameId`,
// the id of the game of `model`, as it gives the id of a game to `GameFactory`.
// The response is empty: nothing in the use case produces a record, and `LoadProgress`
// reads the saved progress (S3-16 in #151).
// No exception leaves `execute()`. A port or a model that throws gives a `save-failed`
// failure. The repository keeps its saved progress when the failure comes before `save()`.
export class SaveProgress implements UseCase<GameResult, void> {
  constructor(
    private readonly repository: ProgressRepository,
    private readonly model: IProgressModel,
    private readonly gameId: GameId,
  ) {}

  async execute(request: GameResult): Promise<Result<void>> {
    try {
      const progress = (await this.repository.load(this.gameId)) ?? GameProgress.start(this.gameId);
      this.model.record(request, progress);
      await this.repository.save(progress);
      return Result.success(undefined);
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.saveFailed, thrown));
    }
  }
}
