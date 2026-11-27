import { AchievementCount } from './achievement-count';
import type { AchievementCounters } from './achievement-counters';
import type { GameId } from '../shared/game-id';
import type { GameProgress } from '../progress/game-progress';
import type { LevelDefinition } from '../progress/level-definition';
import { LevelStatus } from '../progress/level-status';

// The rule that completes one achievement (Strategy, issues #188 and #326, classes.md decision 60).
// A goal of «win 3 levels of Hexa Fit» holds on paper, with no software, so it lives in the domain.
// `ListAchievements` loads the levels, the saved progress and the saved counters of the game
// that `gameId()` names, once per game, and asks each goal with them. A goal calls no repository.
// So an achievement needs no store of its own: the saved progress and the saved counters
// keep it after a restart (issue #364).
// The four goals have the same shape (issue #406): a private constructor, a static `of()` that
// takes the `GameId` and, for a count, an `AchievementCount`, and `isReachedBy()` with three
// required parameters.
export interface AchievementGoal {
  // The id of the game whose levels and progress the goal reads.
  gameId(): GameId;
  // Tells if the levels, the progress and the counters of the game complete the achievement.
  // `progress` is `undefined` when the game has no saved progress. `counters` always exists:
  // the use case gives new counters to a game with no saved counters (issue #406).
  // A goal reads only the data it needs.
  isReachedBy(
    levels: readonly LevelDefinition[],
    progress: GameProgress | undefined,
    counters: AchievementCounters,
  ): boolean;
}

// The count of the levels of `levels` that `LevelStatus.ofEach()` gives as completed.
function wonCountOf(levels: readonly LevelDefinition[], progress: GameProgress | undefined) {
  return LevelStatus.ofEach(levels, progress).filter(([, status]) =>
    status.equals(LevelStatus.completed),
  ).length;
}

// The smallest count of a goal. A goal of 0 holds before the first move.
const ONE = AchievementCount.of(1);

// The message of a goal of the counters with a count below 1.
const GOAL_COUNT = 'The count of a goal needs a whole number of 1 or more.';

// Throws a RangeError with the message `message` when `count` is not 1 or more.
// The error carries the count as its `cause`.
function checkGoalCount(count: AchievementCount, message: string): void {
  if (!count.isAtLeast(ONE)) throw new RangeError(message, { cause: count });
}

// The goal of a count of won levels of one game, for example «win 3 levels of Hexa Fit».
// It counts the levels of every figure. A count below 1 throws a RangeError, and the error
// carries the count as its `cause`.
export class LevelsWon implements AchievementGoal {
  private constructor(
    private readonly game: GameId,
    private readonly count: AchievementCount,
  ) {
    checkGoalCount(count, 'A count of won levels needs a whole number of 1 or more.');
  }

  // The goal of `count` won levels of the game `gameId`.
  static of(gameId: GameId, count: AchievementCount): LevelsWon {
    return new LevelsWon(gameId, count);
  }

  gameId(): GameId {
    return this.game;
  }

  isReachedBy(
    levels: readonly LevelDefinition[],
    progress: GameProgress | undefined,
    _counters: AchievementCounters,
  ): boolean {
    return AchievementCount.of(wonCountOf(levels, progress)).isAtLeast(this.count);
  }
}

// The goal of every level of one game, for example «win every Hexa Fit level».
// A game with no levels never reaches it.
export class EveryLevelWon implements AchievementGoal {
  private constructor(private readonly game: GameId) {}

  // The goal of every level of the game `gameId`.
  static of(gameId: GameId): EveryLevelWon {
    return new EveryLevelWon(gameId);
  }

  gameId(): GameId {
    return this.game;
  }

  isReachedBy(
    levels: readonly LevelDefinition[],
    progress: GameProgress | undefined,
    _counters: AchievementCounters,
  ): boolean {
    return levels.length > 0 && wonCountOf(levels, progress) === levels.length;
  }
}

// The goal of a best count of one game, for example «reach 256 in Hexa Merge» or «clear 3 lines
// at once» (issue #364, part 4 of #277). It reads the best count of the saved counters, the
// highest count of one move. The engine names no variant: the composition root names the game
// and the count, and the events of each variant say what the best count of their game counts
// (`CountsForAchievements`, issue #406).
export class BestCountReached implements AchievementGoal {
  private constructor(
    private readonly game: GameId,
    private readonly count: AchievementCount,
  ) {
    checkGoalCount(count, GOAL_COUNT);
  }

  // The goal of a best count of `count` or more in the game `gameId`.
  static of(gameId: GameId, count: AchievementCount): BestCountReached {
    return new BestCountReached(gameId, count);
  }

  gameId(): GameId {
    return this.game;
  }

  isReachedBy(
    _levels: readonly LevelDefinition[],
    _progress: GameProgress | undefined,
    counters: AchievementCounters,
  ): boolean {
    return counters.bestReaches(this.count);
  }
}

// The goal of a total of one game, for example «complete 10 goals in Hexa Sort» (issue #364,
// part 4 of #277). It reads the total of the saved counters, the sum of every count.
// The composition root names the game and the count.
export class TotalCountReached implements AchievementGoal {
  private constructor(
    private readonly game: GameId,
    private readonly count: AchievementCount,
  ) {
    checkGoalCount(count, GOAL_COUNT);
  }

  // The goal of a total of `count` or more in the game `gameId`.
  static of(gameId: GameId, count: AchievementCount): TotalCountReached {
    return new TotalCountReached(gameId, count);
  }

  gameId(): GameId {
    return this.game;
  }

  isReachedBy(
    _levels: readonly LevelDefinition[],
    _progress: GameProgress | undefined,
    counters: AchievementCounters,
  ): boolean {
    return counters.totalReaches(this.count);
  }
}
