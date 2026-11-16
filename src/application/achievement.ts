import type { GameId } from '../domain/engine/game-id';
import type { LevelRepository } from './level-repository';
import type { ProgressRepository } from './progress-repository';

// The rule that completes one achievement (Strategy, issue #188). `ListAchievements` asks it
// with the two ports of the saved data: the levels of a game and the saved progress of a game.
// A goal reads and writes nothing else, so an achievement needs no store of its own:
// the saved progress keeps it after a restart of the app.
export interface AchievementGoal {
  // Tells if the saved data completes the achievement.
  isReachedWith(levels: LevelRepository, progress: ProgressRepository): Promise<boolean>;
}

// One achievement of the achievements screen (issue #188). It is plain data.
// `id` names the achievement: the presenter finds its name under `achievement.<id>` in the text
// catalog. `goal` decides when the player completes it. An achievement with no goal stays
// in progress: no game event gives its data yet, for example the lines of one placement.
export interface Achievement {
  readonly id: string;
  readonly goal?: AchievementGoal;
}

// The goal of a count of won levels of one game, for example «win 3 levels of Hexa Fit».
// It counts the levels of every figure. A count that is not a whole number of 1 or more
// throws a RangeError, and the error carries the count as its `cause`.
export class LevelsWon implements AchievementGoal {
  constructor(
    private readonly gameId: GameId,
    private readonly count: number,
  ) {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new RangeError('A count of won levels needs a whole number of 1 or more.', {
        cause: count,
      });
    }
  }

  async isReachedWith(levels: LevelRepository, progress: ProgressRepository): Promise<boolean> {
    const { won } = await levelCountsOf(this.gameId, levels, progress);
    return won >= this.count;
  }
}

// The goal of every level of one game, for example «win every Hexa Fit level».
// A game with no levels never reaches it.
export class EveryLevelWon implements AchievementGoal {
  constructor(private readonly gameId: GameId) {}

  async isReachedWith(levels: LevelRepository, progress: ProgressRepository): Promise<boolean> {
    const { won, all } = await levelCountsOf(this.gameId, levels, progress);
    return all > 0 && won === all;
  }
}

// The count of the levels of the game `gameId`, and the count of its won levels.
// A level is won when the saved progress keeps a result of it, zero stars included.
// This is the rule of a completed level in `ListLevels` (S3-12 in #151).
async function levelCountsOf(
  gameId: GameId,
  levels: LevelRepository,
  progress: ProgressRepository,
): Promise<{ won: number; all: number }> {
  const definitions = await levels.list(gameId);
  const saved = await progress.load(gameId);
  const won = definitions.filter((level) => saved?.starsOf(level.levelId()) !== undefined);
  return { won: won.length, all: definitions.length };
}
