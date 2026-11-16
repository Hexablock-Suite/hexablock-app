import type { ProgressRepository } from '../../../src/application/progress-repository';
import { ElapsedTime } from '../../../src/domain/engine/elapsed-time';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameProgress } from '../../../src/domain/engine/game-progress';
import { LevelId } from '../../../src/domain/engine/level-id';
import { Moves } from '../../../src/domain/engine/moves';
import { ProgressRecord } from '../../../src/domain/engine/progress-model';
import { Score } from '../../../src/domain/engine/score';
import { Stars } from '../../../src/domain/engine/stars';
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
// `make()` gives a new, empty repository for each test.
// The progress keeps its fields private, so the suite compares the delivered value objects
// with `equals()` (`sameContent()`).
export function describeProgressRepositoryContract(
  name: string,
  make: () => ProgressRepository,
): void {
  describe(`${name} as a ProgressRepository`, () => {
    it('should_give_no_progress_when_the_game_has_no_saved_progress', async () => {
      await expect(make().load(FIT)).resolves.toBeUndefined();
    });

    it('should_give_back_the_high_score_when_a_progress_with_a_high_score_is_saved', async () => {
      const repository = make();
      const saved = linesProgress(36);

      await repository.save(saved);
      const loaded = await repository.load(LINES);

      expect(loaded?.equals(saved)).toBe(true);
      expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
    });

    // A Fit level has a timer and a Sort level has none, so one record has no time.
    it('should_give_back_each_level_result_in_its_order_when_a_progress_with_level_results_is_saved', async () => {
      const repository = make();
      const saved = GameProgress.start(FIT);
      saved.recordLevel(levelRecord('fit-02', 1, 40, 9000));
      saved.recordLevel(levelRecord('fit-01', 3, 10));

      await repository.save(saved);
      const loaded = await repository.load(FIT);

      expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
      expect(loaded?.keeps(levelRecord('fit-02', 1, 40, 9000))).toBe(true);
      expect(loaded?.keeps(levelRecord('fit-01', 3, 10))).toBe(true);
    });

    it('should_give_back_a_progress_with_no_result_when_a_new_progress_is_saved', async () => {
      const repository = make();
      const saved = GameProgress.start(FIT);

      await repository.save(saved);
      const loaded = await repository.load(FIT);

      expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
    });

    it('should_give_back_the_last_progress_when_a_second_save_of_the_game_replaces_the_first', async () => {
      const repository = make();

      await repository.save(linesProgress(36));
      await repository.save(linesProgress(20));
      const loaded = await repository.load(LINES);

      expect(loaded !== undefined && sameContent(loaded, linesProgress(20))).toBe(true);
    });

    it('should_keep_each_progress_under_its_own_game_when_two_games_are_saved', async () => {
      const repository = make();
      const fit = GameProgress.start(FIT);
      fit.recordLevel(levelRecord('fit-01', 2, 12, 3000));

      await repository.save(fit);
      await repository.save(linesProgress(36));
      const loadedFit = await repository.load(FIT);
      const loadedLines = await repository.load(LINES);

      expect(loadedFit !== undefined && sameContent(loadedFit, fit)).toBe(true);
      expect(loadedLines !== undefined && sameContent(loadedLines, linesProgress(36))).toBe(true);
      await expect(repository.load(GameId.of('hexa-sort'))).resolves.toBeUndefined();
    });
  });
}
