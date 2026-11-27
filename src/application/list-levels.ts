import type { GameId } from '../domain/shared/game-id';
import type { GameProgress } from '../domain/progress/game-progress';
import type { TopologyId } from '../domain/shared/topology-id';
import type { LevelDefinition } from '../domain/progress/level-definition';
import { LevelStatus } from '../domain/progress/level-status';
import type { LevelRepository } from './level-repository';
import type { LevelSummary } from './level-summary';
import type { ProgressRepository } from './progress-repository';
import { caughtError, FailureCode, Result } from './result';
import type { UseCase } from './use-case';

// The request of `ListLevels`: the game and the figure that the player chose (S3-08 in #151).
// The figure is the `TopologyId` of the geometry family of the board.
export interface ListLevelsRequest {
  readonly gameId: GameId;
  readonly figure: TopologyId;
}

// Lists the levels of one game with their progress (APP-FR-02, docs/architecture/flows.md,
// issue #168). It writes nothing: it asks `LevelRepository` for the definitions
// of the game and `ProgressRepository` for the owner of the progress and the saved progress of the
// game of that owner (#46).
// - The list holds only the levels that are played on the chosen figure (S3-08).
//   A level builder refuses a level of another figure, so a level of another figure
//   cannot start. A figure with no level gives an empty list.
// - The list follows the `order` of each level file, not the order of the repository.
// - `LevelStatus.ofEach()` gives the status of each level (S3-12, issue #326): completed, open
//   or locked. The use case gives it only the levels of the chosen figure, in order,
//   so a level of another figure never locks a level of this figure.
// No exception leaves `execute()`. A port that throws gives a `list-failed` failure.
export class ListLevels implements UseCase<ListLevelsRequest, LevelSummary[]> {
  constructor(
    private readonly levels: LevelRepository,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(request: ListLevelsRequest): Promise<Result<LevelSummary[]>> {
    try {
      const levels = await this.levels.list(request.gameId);
      const progress = await this.progress.load(await this.progress.owner(), request.gameId);
      return Result.success(summariesOf(levelsOnFigure(levels, request.figure), progress));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.listFailed, thrown));
    }
  }
}

// The levels that are played on `figure`, in the order of their files (S3-08).
// `ListLevels` and `StartGame` (#397) give this list to `LevelStatus.ofEach()`,
// so both read one order. The sort is stable,
// so two levels of one order keep the order of the repository.
export function levelsOnFigure(
  levels: readonly LevelDefinition[],
  figure: TopologyId,
): LevelDefinition[] {
  const onFigure = levels.filter((level) => level.isPlayedOn(figure));
  return onFigure.sort((left, right) => {
    if (left.comesBefore(right)) return -1;
    if (right.comesBefore(left)) return 1;
    return 0;
  });
}

// One summary per level, in order, with the status that `LevelStatus.ofEach()` gives.
// The stars exist only for a level whose result the progress keeps.
function summariesOf(
  levels: readonly LevelDefinition[],
  progress: GameProgress | undefined,
): LevelSummary[] {
  return LevelStatus.ofEach(levels, progress).map(([level, status]) => {
    const levelId = level.levelId();
    const stars = progress?.starsOf(levelId);
    return stars === undefined ? { levelId, status } : { levelId, status, stars };
  });
}
