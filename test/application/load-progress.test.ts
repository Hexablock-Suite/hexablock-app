/** @jest-environment node */
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { LoadProgress } from '../../src/application/progress/load-progress';
import type { ProgressRepository } from '../../src/application/ports/progress-repository';
import { Result } from '../../src/application/result';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { saveIn } from '../support/adapters/saved-progress';
import { ProgressOwner } from '../../src/application/ports/progress-owner';

// `LoadProgress` reads the saved progress of one game (S3-16 in #151, issue #181, APP-FR-04).
// The tests run the real `LocalProgressRepository` over the in-memory `KeyValueStore`, and
// a hand double for the repository that throws, as `list-achievements.test.ts` does.

const LINES = GameId.of('hexa-lines');

// The high score that a progress of Lines with `score` points keeps.
function highScoreOf(score: number): ProgressRecord {
  return ProgressRecord.of({ gameId: LINES, score: Score.of(score) });
}

describe('LoadProgress', () => {
  it('should_return_the_saved_progress_when_the_repository_keeps_one', async () => {
    const repository = new LocalProgressRepository(new InMemoryKeyValueStore());
    const progress = GameProgress.start(LINES);
    progress.recordScore(highScoreOf(36));
    await saveIn(repository, progress);

    const result = await new LoadProgress(repository).execute({ gameId: LINES });

    expect(result.ok ? result.value?.keeps(highScoreOf(36)) : false).toBe(true);
  });

  // A game that the player never played has no saved progress, and the read is still a success.
  it('should_return_no_progress_when_the_game_has_none_saved', async () => {
    const repository = new LocalProgressRepository(new InMemoryKeyValueStore());

    const result = await new LoadProgress(repository).execute({ gameId: LINES });

    expect(result).toEqual(Result.success(undefined));
  });

  // Issue #410: the request names the game, as the request of `ListLevels` does.
  // So one `LoadProgress` reads the saved progress of every game.
  it('should_read_the_game_of_each_request_when_one_use_case_loads_two_games', async () => {
    const repository = new LocalProgressRepository(new InMemoryKeyValueStore());
    const progress = GameProgress.start(LINES);
    progress.recordScore(highScoreOf(36));
    await saveIn(repository, progress);
    const useCase = new LoadProgress(repository);

    const lines = await useCase.execute({ gameId: LINES });
    const merge = await useCase.execute({ gameId: GameId.of('hexa-merge') });

    expect(lines.ok ? lines.value?.keeps(highScoreOf(36)) : false).toBe(true);
    expect(merge).toEqual(Result.success(undefined));
  });

  it('should_fail_with_load_failed_when_the_progress_repository_throws', async () => {
    const broken: ProgressRepository = {
      load: () => Promise.reject(new Error('The store is gone.')),
      owner: () => Promise.resolve(ProgressOwner.anonymous),
      update: () => Promise.resolve(),
    };

    const result = await new LoadProgress(broken).execute({ gameId: LINES });

    expect(result.ok ? undefined : result.error.code).toBe('load-failed');
    expect(result.ok ? undefined : result.error.message).toBe('The store is gone.');
  });
});
