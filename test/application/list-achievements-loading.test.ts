/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { LevelRepository } from '../../src/application/level-repository';
import { ListAchievements } from '../../src/application/list-achievements';
import type { ProgressRepository } from '../../src/application/progress-repository';
import { EveryLevelWon, LevelsWon } from '../../src/domain/engine/achievement-goal';
import { GameId } from '../../src/domain/engine/game-id';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { delivered } from '../support/engine/value-receiver';

// `ListAchievements` loads the levels and the progress of each game once per call,
// and passes them to each goal of that game (issue #326). A goal calls no repository.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

// Repositories that record the id of the game of each read.
function countingPorts() {
  const reads: string[] = [];
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
  return { reads, levels, progress };
}

describe('ListAchievements loading', () => {
  it('should_load_each_game_once_when_two_goals_read_one_game', async () => {
    const { reads, levels, progress } = countingPorts();
    const list = new ListAchievements(levels, progress, [
      { id: 'fit-3', goal: LevelsWon.of(FIT, 3) },
      { id: 'merge-256' },
      { id: 'sort-3', goal: LevelsWon.of(SORT, 3) },
      { id: 'fit-all', goal: new EveryLevelWon(FIT) },
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
});
