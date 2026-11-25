import type { GameId } from './game-id';
import type { GameProgress } from './game-progress';
import type { LevelDefinition } from './level-definition';
import { LevelStatus } from './level-status';

// The rule that completes one achievement (Strategy, issues #188 and #326, classes.md decision 60).
// A goal of «win 3 levels of Hexa Fit» holds on paper, with no software, so it lives in the domain.
// `ListAchievements` loads the levels and the saved progress of the game that `gameId()` names,
// once per game, and asks each goal with them. A goal calls no repository.
// So an achievement needs no store of its own: the saved progress keeps it after a restart.
export interface AchievementGoal {
  // The id of the game whose levels and progress the goal reads.
  gameId(): GameId;
  // Tells if the levels and the progress of the game complete the achievement.
  // `progress` is `undefined` when the game has no saved progress.
  isReachedBy(levels: readonly LevelDefinition[], progress: GameProgress | undefined): boolean;
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
