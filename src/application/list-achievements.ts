import type { Achievement } from './achievement';
import type { LevelRepository } from './level-repository';
import type { ProgressRepository } from './progress-repository';
import { caughtError, FailureCode, Result } from './result';
import type { UseCase } from './use-case';

// The request of `ListAchievements`. It has no member: the list holds every achievement.
export type ListAchievementsRequest = Readonly<Record<string, never>>;

// One achievement in the list: the plain response model of `ListAchievements` (issue #188).
// `id` is the id of the achievement. `completed` tells a completed achievement
// from an achievement in progress.
export interface AchievementSummary {
  readonly id: string;
  readonly completed: boolean;
}

// Lists the achievements of the player with their status (issue #188).
// It reads and writes nothing itself: each goal asks `LevelRepository` and `ProgressRepository`.
// The saved progress keeps each won level, so a completed achievement stays completed
// after a restart of the app.
// - The list follows the order of `achievements`, the list that the composition root gives.
// - An achievement is completed when its goal is reached. An achievement with no goal
//   stays in progress.
// The composition root names the games of each goal, so this use case never names a variant.
// Two achievements with one id throw a RangeError, because one id names one text.
// No exception leaves `execute()`. A port that throws gives a `list-failed` failure.
export class ListAchievements implements UseCase<ListAchievementsRequest, AchievementSummary[]> {
  constructor(
    private readonly levels: LevelRepository,
    private readonly progress: ProgressRepository,
    private readonly achievements: readonly Achievement[],
  ) {
    achievements.forEach(({ id }, index) => {
      if (achievements.slice(0, index).some((earlier) => earlier.id === id)) {
        throw new RangeError('The list holds two achievements with one id.');
      }
    });
  }

  async execute(_request: ListAchievementsRequest): Promise<Result<AchievementSummary[]>> {
    try {
      const summaries: AchievementSummary[] = [];
      for (const { id, goal } of this.achievements) {
        const completed =
          goal === undefined ? false : await goal.isReachedWith(this.levels, this.progress);
        summaries.push({ id, completed });
      }
      return Result.success(summaries);
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.listFailed, thrown));
    }
  }
}
