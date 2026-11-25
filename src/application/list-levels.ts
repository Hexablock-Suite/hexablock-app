import type { GameId } from '../domain/engine/game-id';
import type { GameProgress } from '../domain/engine/game-progress';
import type { TopologyId } from '../domain/engine/geometry-factory';
import type { LevelDefinition } from '../domain/engine/level-definition';
import { LevelStatus } from '../domain/engine/level-status';
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
// issue #168). It reads and writes nothing: it asks `LevelRepository` for the definitions
// of the game and `ProgressRepository` for the saved progress of the game.
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
      const progress = await this.progress.load(request.gameId);
      const onFigure = levels.filter((level) => level.isPlayedOn(request.figure));
      return Result.success(summariesOf(inOrder(onFigure), progress));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.listFailed, thrown));
    }
  }
}

// The levels in the order of their files. The sort is stable,
// so two levels of one order keep the order of the repository.
function inOrder(levels: readonly LevelDefinition[]): LevelDefinition[] {
  return [...levels].sort((left, right) => {
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
