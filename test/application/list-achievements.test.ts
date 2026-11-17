/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { EveryLevelWon, LevelsWon, type Achievement } from '../../src/application/achievement';
import { ListAchievements, type AchievementSummary } from '../../src/application/list-achievements';
import type { ProgressRepository } from '../../src/application/progress-repository';
import type { Result } from '../../src/application/result';
import { GameId } from '../../src/domain/engine/game-id';
import { GameProgress } from '../../src/domain/engine/game-progress';
import { LevelId } from '../../src/domain/engine/level-id';
import { Moves } from '../../src/domain/engine/moves';
import { ProgressRecord } from '../../src/domain/engine/progress-model';
import { Score } from '../../src/domain/engine/score';
import { Stars } from '../../src/domain/engine/stars';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { delivered } from '../support/engine/value-receiver';

// `ListAchievements` gives each achievement of its list with its status: completed or in
// progress (issue #188). The level achievements read the saved progress of a game and the levels
// of that game. The tests run the real `BundledLevelRepository` (15 Fit levels and 10 Sort
// levels) and the real `LocalProgressRepository` over the in-memory `KeyValueStore`.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');
const LINES = GameId.of('hexa-lines');

// The ids and the statuses of a success, or the code of a failure.
function rowsOf(result: Result<AchievementSummary[]>): [string, boolean][] | string {
  return result.ok ? result.value.map(({ id, completed }) => [id, completed]) : result.error.code;
}

// A progress repository with the results of the levels `levelIds` of the game `gameId`.
// Each result has `stars` stars, so a test can save a level won with zero stars.
async function progressWith(
  gameId: GameId,
  levelIds: readonly string[],
  stars = 3,
): Promise<ProgressRepository> {
  const repository = new LocalProgressRepository(new InMemoryKeyValueStore());
  const progress = GameProgress.start(gameId);
  for (const levelId of levelIds) {
    progress.recordLevel(
      ProgressRecord.of({
        gameId,
        score: Score.of(0),
        levelId: LevelId.of(levelId),
        stars: Stars.of(stars),
        moves: Moves.of(3),
      }),
    );
  }
  await repository.save(progress);
  return repository;
}

// The ids of the bundled levels of the game `gameId`, in the order of the repository.
async function bundledIds(gameId: GameId): Promise<string[]> {
  const levels = await new BundledLevelRepository().list(gameId);
  return levels.map((level) => delivered(level.levelId()));
}

// `ListAchievements` over the bundled levels and the progress `progress`.
function listOf(achievements: readonly Achievement[], progress: ProgressRepository) {
  return new ListAchievements(new BundledLevelRepository(), progress, achievements);
}

describe('ListAchievements', () => {
  // «Win 3 levels of Hexa Fit»: three won levels complete it, two do not.
  // A level is won when the progress keeps a result of it, zero stars included (S3-12).
  it('should_complete_a_count_of_won_levels_when_the_progress_keeps_that_many_levels', async () => {
    const achievement = { id: 'fit-3', goal: new LevelsWon(FIT, 3) };

    const two = await listOf([achievement], await progressWith(FIT, ['fit-01', 'fit-02'])).execute(
      {},
    );
    const three = await listOf(
      [achievement],
      await progressWith(FIT, ['fit-01', 'fit-02', 'fit-03'], 0),
    ).execute({});

    expect(rowsOf(two)).toEqual([['fit-3', false]]);
    expect(rowsOf(three)).toEqual([['fit-3', true]]);
  });

  // The progress of one game never counts for another game.
  it('should_keep_a_count_of_won_levels_in_progress_when_another_game_won_the_levels', async () => {
    const progress = await progressWith(FIT, ['fit-01', 'fit-02', 'fit-03']);

    const result = await listOf([{ id: 'sort-3', goal: new LevelsWon(SORT, 3) }], progress).execute(
      {},
    );

    expect(rowsOf(result)).toEqual([['sort-3', false]]);
  });

  // «Win every Hexa Fit level»: every level of the level repository needs a result.
  // A game with no levels never completes it.
  it('should_complete_every_level_won_only_when_each_level_of_the_game_is_won', async () => {
    const achievements = [
      { id: 'fit-all', goal: new EveryLevelWon(FIT) },
      { id: 'lines-all', goal: new EveryLevelWon(LINES) },
    ];

    const some = await listOf(achievements, await progressWith(FIT, ['fit-01', 'fit-03'])).execute(
      {},
    );
    const every = await listOf(
      achievements,
      await progressWith(FIT, await bundledIds(FIT)),
    ).execute({});

    expect(rowsOf(some)).toEqual([
      ['fit-all', false],
      ['lines-all', false],
    ]);
    expect(rowsOf(every)).toEqual([
      ['fit-all', true],
      ['lines-all', false],
    ]);
  });

  // An achievement with no goal waits for the game event that gives its data, so it stays
  // in progress. The list keeps the order of the achievements and their ids.
  it('should_keep_the_order_and_leave_an_achievement_with_no_goal_in_progress_when_listed', async () => {
    const progress = await progressWith(FIT, ['fit-01', 'fit-02', 'fit-03']);

    const result = await listOf(
      [{ id: 'merge-256' }, { id: 'fit-3', goal: new LevelsWon(FIT, 3) }, { id: 'sort-goals' }],
      progress,
    ).execute({});

    expect(rowsOf(result)).toEqual([
      ['merge-256', false],
      ['fit-3', true],
      ['sort-goals', false],
    ]);
  });

  it('should_fail_with_list_failed_when_the_progress_repository_throws', async () => {
    const broken: ProgressRepository = {
      load: () => Promise.reject(new Error('The store is gone.')),
      save: () => Promise.resolve(),
    };

    const result = await listOf([{ id: 'fit-3', goal: new LevelsWon(FIT, 3) }], broken).execute({});

    expect(rowsOf(result)).toBe('list-failed');
    expect(result.ok ? undefined : result.error.message).toBe('The store is gone.');
  });

  // One id names one text of the screen, so two achievements with one id are refused.
  it('should_throw_a_range_error_when_two_achievements_have_one_id', async () => {
    const progress = await progressWith(FIT, []);

    expect(() => listOf([{ id: 'fit-3' }, { id: 'fit-3' }], progress)).toThrow(
      new RangeError('The list holds two achievements with one id.'),
    );
  });

  // A count of won levels is a whole number of 1 or more. The error carries the count.
  it('should_throw_a_range_error_when_a_count_of_won_levels_is_not_a_whole_number_of_1_or_more', () => {
    for (const count of [0, -1, 2.5, Number.NaN]) {
      let caught: unknown;
      try {
        new LevelsWon(FIT, count);
      } catch (error) {
        caught = error;
      }

      expect(caught).toEqual(
        new RangeError('A count of won levels needs a whole number of 1 or more.'),
      );
      expect((caught as Error).cause).toBe(count);
    }
  });
});
