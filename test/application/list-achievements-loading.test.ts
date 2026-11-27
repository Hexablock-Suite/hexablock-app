/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LocalAchievementCounterRepository } from '../../src/adapters/local-achievement-counter-repository';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { AchievementCounterRepository } from '../../src/application/achievement-counter-repository';
import type { LevelRepository } from '../../src/application/level-repository';
import { ListAchievements } from '../../src/application/list-achievements';
import type { ProgressRepository } from '../../src/application/progress-repository';
import { AchievementCount } from '../../src/domain/achievements/achievement-count';
import {
  BestCountReached,
  EveryLevelWon,
  LevelsWon,
  TotalCountReached,
} from '../../src/domain/achievements/achievement-goal';
import { GameId } from '../../src/domain/shared/game-id';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { delivered } from '../support/engine/value-receiver';

// `ListAchievements` loads the levels and the progress of each game once per call,
// and passes them to each goal of that game (issue #326). A goal calls no repository.
// Since #364 it loads the saved counters of each game once per call too.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');
const MERGE = GameId.of('hexa-merge');

// Repositories that record the id of the game of each read. The reads of the counters
// go to `counterReads`.
function countingPorts() {
  const reads: string[] = [];
  const counterReads: string[] = [];
  const saved = new LocalAchievementCounterRepository(new InMemoryKeyValueStore());
  const bundled = new BundledLevelRepository();
  const local = new LocalProgressRepository(new InMemoryKeyValueStore());
  const levels: LevelRepository = {
    list: (gameId) => {
      reads.push(`levels ${delivered(gameId)}`);
      return bundled.list(gameId);
    },
    levelOf: (gameId, levelId) => bundled.levelOf(gameId, levelId),
  };
  const progress: ProgressRepository = {
    load: (gameId) => {
      reads.push(`progress ${delivered(gameId)}`);
      return local.load(gameId);
    },
    save: (saved) => local.save(saved),
  };
  const counters: AchievementCounterRepository = {
    load: (gameId) => {
      counterReads.push(delivered(gameId));
      return saved.load(gameId);
    },
    save: (counted) => saved.save(counted),
  };
  return { reads, counterReads, levels, progress, counters };
}

describe('ListAchievements loading', () => {
  it('should_load_each_game_once_when_two_goals_read_one_game', async () => {
    const { reads, levels, progress, counters } = countingPorts();
    const list = new ListAchievements(levels, progress, counters, [
      { id: 'fit-3', goal: LevelsWon.of(FIT, AchievementCount.of(3)) },
      { id: 'merge-256' },
      { id: 'sort-3', goal: LevelsWon.of(SORT, AchievementCount.of(3)) },
      { id: 'fit-all', goal: EveryLevelWon.of(FIT) },
    ]);

    const result = await list.execute({});

    expect(result.ok).toBe(true);
    expect(reads).toEqual([
      'levels hexa-fit',
      'progress hexa-fit',
      'levels hexa-sort',
      'progress hexa-sort',
    ]);
  });

  it('should_load_the_counters_of_each_game_once_when_two_goals_read_one_game', async () => {
    const { counterReads, levels, progress, counters } = countingPorts();
    const list = new ListAchievements(levels, progress, counters, [
      { id: 'merge-256', goal: BestCountReached.of(MERGE, AchievementCount.of(256)) },
      { id: 'fit-3', goal: LevelsWon.of(FIT, AchievementCount.of(3)) },
      { id: 'merge-2048', goal: BestCountReached.of(MERGE, AchievementCount.of(2048)) },
      { id: 'sort-goals', goal: TotalCountReached.of(SORT, AchievementCount.of(10)) },
    ]);

    const result = await list.execute({});

    expect(result.ok).toBe(true);
    expect(counterReads).toEqual(['hexa-merge', 'hexa-fit', 'hexa-sort']);
  });
});
