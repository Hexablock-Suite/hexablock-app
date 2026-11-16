import type { GameId } from '../domain/engine/game-id';
import type { GameProgress } from '../domain/engine/game-progress';
import type { TopologyId } from '../domain/engine/geometry-factory';
import type { LevelDefinition } from '../domain/engine/level-definition';
import type { Stars } from '../domain/engine/stars';
import type { LevelRepository } from './level-repository';
import { LevelStatus, type LevelSummary } from './level-summary';
import type { ProgressRepository } from './progress-repository';
import { caughtError, Result } from './result';
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
// - A level is completed when the progress keeps the stars of a result of it,
//   zero stars included. The first level of the list is open. The level after a completed level
//   is open, and every other level is locked (S3-12). The order counts only the levels
//   of the chosen figure, so a level of another figure never locks a level of this figure.
// A game with no saved progress has no completed level.
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
      return Result.failure(caughtError('list-failed', thrown));
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

// One summary per level, in order. The status of each level reads the status of the level before.
function summariesOf(
  levels: readonly LevelDefinition[],
  progress: GameProgress | undefined,
): LevelSummary[] {
  const summaries: LevelSummary[] = [];
  let before: LevelStatus | undefined;
  for (const level of levels) {
    const levelId = level.levelId();
    const stars = progress?.starsOf(levelId);
    const status = statusOf(stars, before);
    summaries.push(stars === undefined ? { levelId, status } : { levelId, status, stars });
    before = status;
  }
  return summaries;
}

// The status of a level from its stars and from the status of the level before it (S3-12).
// The first level has no level before it.
function statusOf(stars: Stars | undefined, before: LevelStatus | undefined): LevelStatus {
  if (stars !== undefined) return LevelStatus.completed;
  if (before === undefined || before.equals(LevelStatus.completed)) return LevelStatus.open;
  return LevelStatus.locked;
}
