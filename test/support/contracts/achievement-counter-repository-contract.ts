import type { AchievementCounterRepository } from '../../../src/application/achievement-counter-repository';
import { AchievementCount } from '../../../src/domain/engine/achievement-count';
import { AchievementCounters } from '../../../src/domain/engine/achievement-counters';
import { GameId } from '../../../src/domain/engine/game-id';
import { countersContentOf, countsOf } from '../engine/counters-content';

const LINES = GameId.of('hexa-lines');
const SORT = GameId.of('hexa-sort');

// The counters of the game `gameId` with the best count `best` and the total `total`.
function countersOf(gameId: GameId, best: number, total: number): AchievementCounters {
  const counters = AchievementCounters.start(gameId);
  counters.recordBest(AchievementCount.of(best));
  counters.addToTotal(AchievementCount.of(total));
  return counters;
}

// The contract of the `AchievementCounterRepository` port (classes.md decision 57, issue #363).
// Every adapter of the port runs the same suite, so they behave the same.
// `make()` gives a new, empty repository for each test.
// The counters keep their fields private, so the suite reads what they deliver.
export function describeAchievementCounterRepositoryContract(
  name: string,
  make: () => AchievementCounterRepository,
): void {
  describe(`${name} as an AchievementCounterRepository`, () => {
    it('should_give_no_counters_when_the_game_has_no_saved_counters', async () => {
      await expect(make().load(LINES)).resolves.toBeUndefined();
    });

    it('should_give_back_the_best_count_and_the_total_when_counters_are_saved', async () => {
      const repository = make();
      const saved = countersOf(LINES, 3, 12);

      await repository.save(saved);
      const loaded = await repository.load(LINES);

      expect(loaded?.equals(saved)).toBe(true);
      expect(loaded === undefined ? undefined : countersContentOf(loaded)).toEqual({
        gameId: LINES,
        best: 3,
        total: 12,
      });
    });

    it('should_give_back_the_last_counters_when_a_second_save_of_the_game_replaces_the_first', async () => {
      const repository = make();

      await repository.save(countersOf(LINES, 3, 0));
      await repository.save(countersOf(LINES, 2, 1));

      expect(countsOf(await repository.load(LINES))).toEqual({ best: 2, total: 1 });
    });

    it('should_keep_the_counters_of_each_game_under_that_game_when_two_games_are_saved', async () => {
      const repository = make();

      await repository.save(countersOf(LINES, 3, 0));
      await repository.save(countersOf(SORT, 0, 10));

      expect(countsOf(await repository.load(LINES))).toEqual({ best: 3, total: 0 });
      expect(countsOf(await repository.load(SORT))).toEqual({ best: 0, total: 10 });
      await expect(repository.load(GameId.of('hexa-merge'))).resolves.toBeUndefined();
    });
  });
}
