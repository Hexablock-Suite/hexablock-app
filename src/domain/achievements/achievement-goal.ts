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
export interface AchievementGoal {
  // The id of the game whose levels and progress the goal reads.
  gameId(): GameId;
  // Tells if the levels, the progress and the counters of the game complete the achievement.
  // `progress` is `undefined` when the game has no saved progress, and `counters` is
  // `undefined` when the game has no saved counters. A goal reads only the data it needs.
  isReachedBy(
    levels: readonly LevelDefinition[],
    progress: GameProgress | undefined,
    counters?: AchievementCounters,
  ): boolean;
}

// The count of the levels of `levels` that `LevelStatus.ofEach()` gives as completed.
function wonCountOf(levels: readonly LevelDefinition[], progress: GameProgress | undefined) {
  return LevelStatus.ofEach(levels, progress).filter(([, status]) =>
    status.equals(LevelStatus.completed),
  ).length;
}

// The goal of a count of won levels of one game, for example «win 3 levels of Hexa Fit».
// It counts the levels of every figure. A count that is not a whole number of 1 or more
// throws a RangeError, and the error carries the count as its `cause`.
export class LevelsWon implements AchievementGoal {
  private constructor(
    private readonly game: GameId,
    private readonly count: number,
  ) {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new RangeError('A count of won levels needs a whole number of 1 or more.', {
        cause: count,
      });
    }
  }

  // The goal of `count` won levels of the game `gameId`.
  static of(gameId: GameId, count: number): LevelsWon {
    return new LevelsWon(gameId, count);
  }

  gameId(): GameId {
    return this.game;
  }

  isReachedBy(levels: readonly LevelDefinition[], progress: GameProgress | undefined): boolean {
    return wonCountOf(levels, progress) >= this.count;
  }
}

// The goal of every level of one game, for example «win every Hexa Fit level».
// A game with no levels never reaches it.
export class EveryLevelWon implements AchievementGoal {
  constructor(private readonly game: GameId) {}

  gameId(): GameId {
    return this.game;
  }

  isReachedBy(levels: readonly LevelDefinition[], progress: GameProgress | undefined): boolean {
    return levels.length > 0 && wonCountOf(levels, progress) === levels.length;
  }
}

// The smallest count of a goal of the counters. A goal of 0 holds before the first move.
const ONE = AchievementCount.of(1);

// Throws a RangeError when `count` is not 1 or more. The error carries the count as its `cause`.
function checkGoalCount(count: AchievementCount): void {
  if (!count.isAtLeast(ONE)) {
    throw new RangeError('The count of a goal needs a whole number of 1 or more.', {
      cause: count,
    });
  }
}

// The goal of a best count of one game, for example «reach 256 in Hexa Merge» or «clear 3 lines
// at once» (issue #364, part 4 of #277). It reads the best count of the saved counters, the
// highest count of one move. The engine names no variant: the composition root names the game
// and the count, and the listener of the edge says what the best count of each game counts.
export class BestCountReached implements AchievementGoal {
  private constructor(
    private readonly game: GameId,
    private readonly count: AchievementCount,
  ) {
    checkGoalCount(count);
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
    counters?: AchievementCounters,
  ): boolean {
    return counters?.bestReaches(this.count) ?? false;
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
    checkGoalCount(count);
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
    counters?: AchievementCounters,
  ): boolean {
    return counters?.totalReaches(this.count) ?? false;
  }
}
