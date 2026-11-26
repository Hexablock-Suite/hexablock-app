/** @jest-environment node */
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { LoadProgress } from '../../src/application/load-progress';
import type { ProgressRepository } from '../../src/application/progress-repository';
import { Result } from '../../src/application/result';
import { GameId } from '../../src/domain/engine/game-id';
import { GameProgress } from '../../src/domain/engine/game-progress';
import { ProgressRecord } from '../../src/domain/engine/progress-model';
import { Score } from '../../src/domain/engine/score';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';

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
    await repository.save(progress);

    const result = await new LoadProgress(repository, LINES).execute({});

    expect(result.ok ? result.value?.keeps(highScoreOf(36)) : false).toBe(true);
  });

  // A game that the player never played has no saved progress, and the read is still a success.
  it('should_return_no_progress_when_the_game_has_none_saved', async () => {
    const repository = new LocalProgressRepository(new InMemoryKeyValueStore());

    const result = await new LoadProgress(repository, LINES).execute({});

    expect(result).toEqual(Result.success(undefined));
  });

  it('should_fail_with_load_failed_when_the_progress_repository_throws', async () => {
    const broken: ProgressRepository = {
      load: () => Promise.reject(new Error('The store is gone.')),
      save: () => Promise.resolve(),
    };

    const result = await new LoadProgress(broken, LINES).execute({});

    expect(result.ok ? undefined : result.error.code).toBe('load-failed');
    expect(result.ok ? undefined : result.error.message).toBe('The store is gone.');
  });
});
