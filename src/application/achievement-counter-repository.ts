import type { AchievementCounters } from '../domain/engine/achievement-counters';
import type { GameId } from '../domain/engine/game-id';

// Output port and repository of the counters aggregate (classes.md decisions 52 and 57,
// issue #363, part 3 of #277). It saves and gives back the whole aggregate root,
// `AchievementCounters`: the best count and the total of one game.
// The device keeps one set of counters per game, so the game id finds it.
// The counters are their own aggregate, apart from `GameProgress`, so a save of the counters
// and a save of the progress never write the same saved text.
// `LocalAchievementCounterRepository` in layer 3 implements it over `KeyValueStore`.
export interface AchievementCounterRepository {
  // Gives back the saved counters of the game, or `undefined` when the game has none.
  load(gameId: GameId): Promise<AchievementCounters | undefined>;
  // Saves the counters in place of the counters of their game that the repository holds.
  save(counters: AchievementCounters): Promise<void>;
}
