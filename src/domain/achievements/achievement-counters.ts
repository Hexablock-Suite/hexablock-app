import { AchievementCount } from './achievement-count';
import type { GameId } from '../shared/game-id';

// The counters of the achievements of one game (issue #363, part 3 of #277).
// The goals of #364 read them: the most lines at once in Hexa Lines, the highest tile in
// Hexa Merge, and the goals of every Hexa Sort game. The engine names no variant, so the
// counters keep two generic counts:
// - `best` is the highest count of one move. `recordBest()` keeps a count only when it is
//   above the stored best, so a lower count never replaces it.
// - `total` adds every count. `addToTotal()` adds a count to it.
// Both start at 0. An undo takes no count back, because an event is a fact (decision 26).
// It is an entity, and the root of its own aggregate: `AchievementCounterRepository` saves
// it whole, apart from `GameProgress` (decision 52, one repository per aggregate).
// Its identity is the id of its game, because the device keeps one set of counters per game.
// Every field is private. A repository of the edge receives the fields through `deliverTo()`.
// It builds saved counters again with `start()`, `recordBest()` and `addToTotal()`.
export class AchievementCounters {
  private best = AchievementCount.of(0);
  private total = AchievementCount.of(0);

  private constructor(private readonly gameId: GameId) {}

  // New counters of the game `gameId`, with a best count and a total of 0.
  static start(gameId: GameId): AchievementCounters {
    return new AchievementCounters(gameId);
  }

  // Two counters are equal when they belong to one game.
  equals(other: AchievementCounters): boolean {
    return this.gameId.equals(other.gameId);
  }

  // Keeps `count` as the best count when it is above the stored best count.
  recordBest(count: AchievementCount): void {
    if (!this.best.isAtLeast(count)) this.best = count;
  }

  // Adds `count` to the total.
  addToTotal(count: AchievementCount): void {
    this.total = this.total.plus(count);
  }

  // Tells if the best count is `count` or above it.
  bestReaches(count: AchievementCount): boolean {
    return this.best.isAtLeast(count);
  }

  // Tells if the total is `count` or above it.
  totalReaches(count: AchievementCount): boolean {
    return this.total.isAtLeast(count);
  }

  // Gives the game id, the best count and the total to `receiver`. It returns nothing.
  // Only a repository of the edge calls it (rule R-no-delivery-call).
  deliverTo(receiver: AchievementCountersReceiver): void {
    receiver.receive(this.gameId, this.best, this.total);
  }
}

// The receiver of the data of `AchievementCounters`. A repository of the edge implements it,
// for example to save the counters (issue #363). No code of `src/domain/`
// or `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface AchievementCountersReceiver {
  receive(gameId: GameId, best: AchievementCount, total: AchievementCount): void;
}
