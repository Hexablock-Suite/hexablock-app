/** @jest-environment node */
import { ApiLevelRepository } from '../../src/adapters/api/api-level-repository';
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { CombinedLevelRepository } from '../../src/adapters/combined-level-repository';
import { LocalAchievementCounterRepository } from '../../src/adapters/local-achievement-counter-repository';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { LevelList } from '../../src/application/level-summary';
import { ListAchievements } from '../../src/application/list-achievements';
import { ListLevels } from '../../src/application/list-levels';
import type { Result } from '../../src/application/result';
import { EveryLevelWon } from '../../src/domain/achievements/achievement-goal';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { GameId } from '../../src/domain/shared/game-id';
import { Score } from '../../src/domain/shared/score';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { AnsweringLevelsApi } from '../support/adapters/levels-api-double';
import { saveIn } from '../support/adapters/saved-progress';
import { delivered } from '../support/engine/value-receiver';
import { fitLevelFile } from '../support/variants/hexa-fit/fit-level-file';

// Issue #48: a level that only the backend has adds a level to its game (DS-11). Two rules read
// the list of the levels of a game: the chain of open levels (S3-12) and the goal of `fit-all`,
// which asks for every level of the game. The tests pin both with the backend level `fit-16`
// after the 15 bundled hex levels of Fit. The rules read the list that the repository holds when
// the use case runs, so the backend has answered before each use case runs.

const FIT = GameId.of('hexa-fit');
const BACKEND_LEVEL = { ...fitLevelFile(), levelId: 'fit-16', order: 16 };

// The bundled levels joined with a backend that has answered `fit-16`.
async function levelsWithBackendLevel(): Promise<CombinedLevelRepository> {
  const backend = new ApiLevelRepository(new AnsweringLevelsApi([BACKEND_LEVEL]));
  await backend.refresh();
  return new CombinedLevelRepository(new BundledLevelRepository(), backend);
}

// Saves a won result with one star of each Fit level of `levelIds`.
async function saveWon(progress: LocalProgressRepository, levelIds: readonly string[]) {
  const saved = GameProgress.start(FIT);
  for (const levelId of levelIds) {
    saved.recordLevel(
      ProgressRecord.of({
        gameId: FIT,
        score: Score.of(0),
        levelId: LevelId.of(levelId),
        stars: Stars.of(1),
      }),
    );
  }
  await saveIn(progress, saved);
}

// The text of the id and whether the level is locked, for the last level of a success.
function lastOf(result: Result<LevelList>): [string, boolean] | string {
  if (!result.ok) return result.error.code;
  const last = result.value.levels.at(-1);
  return last === undefined
    ? 'none'
    : [delivered(last.levelId), last.status.equals(LevelStatus.locked)];
}

describe('backend levels in the use cases', () => {
  // S3-12: the backend level follows the order of its game, so it opens after level 15.
  it('should_open_the_backend_level_only_when_the_level_before_it_is_won', async () => {
    const progress = new LocalProgressRepository(new InMemoryKeyValueStore());
    const list = new ListLevels(await levelsWithBackendLevel(), progress);

    const before = await list.execute({ gameId: FIT, figure: TopologyId.hex });
    await saveWon(progress, ['fit-15']);
    const after = await list.execute({ gameId: FIT, figure: TopologyId.hex });

    expect(before.ok && before.value.levels.length).toBe(16);
    expect([lastOf(before), lastOf(after)]).toEqual([
      ['fit-16', true],
      ['fit-16', false],
    ]);
  });

  // `fit-all` asks for every level of the game, so the backend level counts too.
  it('should_reach_fit_all_only_when_the_backend_level_is_won_too', async () => {
    const store = new InMemoryKeyValueStore();
    const progress = new LocalProgressRepository(store);
    const achievements = new ListAchievements(
      await levelsWithBackendLevel(),
      progress,
      new LocalAchievementCounterRepository(store),
      [{ id: 'fit-all', goal: EveryLevelWon.of(FIT) }],
    );
    const bundled = (await new BundledLevelRepository().list(FIT)).map((level) =>
      delivered(level.levelId()),
    );

    await saveWon(progress, bundled);
    const withoutBackendLevel = await achievements.execute({});
    await saveWon(progress, [...bundled, 'fit-16']);
    const withBackendLevel = await achievements.execute({});

    expect(bundled).toHaveLength(21);
    expect(
      [withoutBackendLevel, withBackendLevel].map((result) => result.ok && result.value),
    ).toEqual([[{ id: 'fit-all', completed: false }], [{ id: 'fit-all', completed: true }]]);
  });
});
