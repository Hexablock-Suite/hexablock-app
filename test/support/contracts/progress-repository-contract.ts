import type { ProgressRepository } from '../../../src/application/progress-repository';
import { saveIn } from '../adapters/saved-progress';
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import { GameId } from '../../../src/domain/shared/game-id';
import { GameProgress } from '../../../src/domain/progress/game-progress';
import { LevelId } from '../../../src/domain/progress/level-id';
import { Moves } from '../../../src/domain/shared/moves';
import { ProgressRecord } from '../../../src/domain/progress/progress-model';
import { Score } from '../../../src/domain/shared/score';
import { Stars } from '../../../src/domain/progress/stars';
import { sameContent } from '../engine/progress-content';

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');

// The record of one play of the level `level` of Hexa Fit. A level with no timer gives no time.
const levelRecord = (level: string, stars: number, moves: number, ms?: number) =>
  ProgressRecord.of({
    gameId: FIT,
    score: Score.of(0),
    levelId: LevelId.of(level),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ms === undefined ? undefined : ElapsedTime.ofMs(ms),
  });

// The progress of Hexa Lines with the high score `score`.
function linesProgress(score: number): GameProgress {
  const progress = GameProgress.start(LINES);
  progress.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(score) }));
  return progress;
}

// The contract of the `ProgressRepository` port (classes.md decisions 56 and 57, issue #164).
// Every adapter of the port runs the same suite, so they behave the same.
// `make()` gives a new, empty repository for each test. Each call takes the owner that `owner()`
// of the repository gives, as a use case does (#46).
// The progress keeps its fields private, so the suite compares the delivered value objects
// with `equals()` (`sameContent()`).
// Saves `progress` for the owner of `repository` through `update()`.
async function save(repository: ProgressRepository, progress: GameProgress): Promise<void> {
  await saveIn(repository, progress, await repository.owner());
}

// The saved progress of `gameId` for the owner of `repository`.
async function load(repository: ProgressRepository, gameId: GameId) {
  return repository.load(await repository.owner(), gameId);
}

export function describeProgressRepositoryContract(
  name: string,
  make: () => ProgressRepository,
): void {
  describe(`${name} as a ProgressRepository`, () => {
    it('should_give_no_progress_when_the_game_has_no_saved_progress', async () => {
      await expect(load(make(), FIT)).resolves.toBeUndefined();
    });

    it('should_give_back_the_high_score_when_a_progress_with_a_high_score_is_saved', async () => {
      const repository = make();
      const saved = linesProgress(36);

      await save(repository, saved);
      const loaded = await load(repository, LINES);

      expect(loaded?.equals(saved)).toBe(true);
      expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
    });

    // A Fit level has a timer and a Sort level has none, so one record has no time.
    it('should_give_back_each_level_result_in_its_order_when_a_progress_with_level_results_is_saved', async () => {
      const repository = make();
      const saved = GameProgress.start(FIT);
      saved.recordLevel(levelRecord('fit-02', 1, 40, 9000));
      saved.recordLevel(levelRecord('fit-01', 3, 10));

      await save(repository, saved);
      const loaded = await load(repository, FIT);

      expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
      expect(loaded?.keeps(levelRecord('fit-02', 1, 40, 9000))).toBe(true);
      expect(loaded?.keeps(levelRecord('fit-01', 3, 10))).toBe(true);
    });

    it('should_give_back_a_progress_with_no_result_when_a_new_progress_is_saved', async () => {
      const repository = make();
      const saved = GameProgress.start(FIT);

      await save(repository, saved);
      const loaded = await load(repository, FIT);

      expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
    });

    it('should_keep_the_best_high_score_when_a_second_update_of_the_game_gives_a_worse_one', async () => {
      const repository = make();

      await save(repository, linesProgress(36));
      await save(repository, linesProgress(20));
      const loaded = await load(repository, LINES);

      expect(loaded !== undefined && sameContent(loaded, linesProgress(36))).toBe(true);
    });

    // #46, judgment-day round 1 (F1): `update()` runs load, change and save in one queue per key,
    // so two updates that run at once keep both changes.
    it('should_keep_both_changes_when_two_updates_of_one_game_run_at_once', async () => {
      const repository = make();
      const owner = await repository.owner();

      await Promise.all([
        repository.update(owner, FIT, (progress) =>
          progress.recordLevel(levelRecord('fit-01', 3, 10, 5000)),
        ),
        repository.update(owner, FIT, (progress) =>
          progress.recordLevel(levelRecord('fit-02', 2, 20, 7000)),
        ),
      ]);
      const loaded = await load(repository, FIT);

      expect(loaded?.keeps(levelRecord('fit-01', 3, 10, 5000))).toBe(true);
      expect(loaded?.keeps(levelRecord('fit-02', 2, 20, 7000))).toBe(true);
    });

    it('should_keep_the_saved_progress_when_a_change_throws', async () => {
      const repository = make();
      const owner = await repository.owner();
      await save(repository, linesProgress(36));

      const update = repository.update(owner, LINES, (progress) => {
        progress.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(90) }));
        throw new RangeError('The model refuses the result.');
      });

      await expect(update).rejects.toThrow(new RangeError('The model refuses the result.'));
      const loaded = await load(repository, LINES);
      expect(loaded !== undefined && sameContent(loaded, linesProgress(36))).toBe(true);
    });

    it('should_keep_each_progress_under_its_own_game_when_two_games_are_saved', async () => {
      const repository = make();
      const fit = GameProgress.start(FIT);
      fit.recordLevel(levelRecord('fit-01', 2, 12, 3000));

      await save(repository, fit);
      await save(repository, linesProgress(36));
      const loadedFit = await load(repository, FIT);
      const loadedLines = await load(repository, LINES);

      expect(loadedFit !== undefined && sameContent(loadedFit, fit)).toBe(true);
      expect(loadedLines !== undefined && sameContent(loadedLines, linesProgress(36))).toBe(true);
      await expect(load(repository, GameId.of('hexa-sort'))).resolves.toBeUndefined();
    });
  });
}
