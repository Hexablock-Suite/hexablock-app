/** @jest-environment node */
import { ElapsedTime } from '../../../src/domain/engine/elapsed-time';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameProgress } from '../../../src/domain/engine/game-progress';
import { HighScoreProgress } from '../../../src/domain/engine/high-score-progress';
import { LevelId } from '../../../src/domain/engine/level-id';
import { LevelProgress, type ILevelStars } from '../../../src/domain/engine/level-progress';
import { Moves } from '../../../src/domain/engine/moves';
import { GameResult, ProgressRecord } from '../../../src/domain/engine/progress-model';
import { Score } from '../../../src/domain/engine/score';
import { Stars } from '../../../src/domain/engine/stars';

// The local progress of one game is one object with the high score and the best result
// of each level (S3-04, issue #156). A progress model records each result in it.
// The progress keeps the best record by the order of DS-4 and DS-12.

const gameId = GameId.of('fake-game');
const highScore = (score: number) => ProgressRecord.of({ gameId, score: Score.of(score) });
// The record of one play of the level `level`. A level with no timer gives no time.
const levelRecord = (level: string, stars: number, moves: number, ms?: number) =>
  ProgressRecord.of({
    gameId,
    score: Score.of(0),
    levelId: LevelId.of(level),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ms === undefined ? undefined : ElapsedTime.ofMs(ms),
  });

describe('GameProgress', () => {
  it('should_keep_the_higher_high_score_when_two_scores_are_recorded', () => {
    const progress = GameProgress.start(gameId);

    expect(progress.keeps(highScore(35))).toBe(false);
    progress.recordScore(highScore(35));
    progress.recordScore(highScore(36));
    progress.recordScore(highScore(20));

    expect(progress.keeps(highScore(36))).toBe(true);
    expect(progress.keeps(highScore(35))).toBe(false);
    expect(progress.keeps(highScore(20))).toBe(false);
  });

  it('should_keep_the_best_result_of_a_level_when_two_results_of_the_level_are_recorded', () => {
    const progress = GameProgress.start(gameId);

    progress.recordLevel(levelRecord('l1', 1, 9, 1000));
    progress.recordLevel(levelRecord('l1', 2, 30, 9000));
    expect(progress.keeps(levelRecord('l1', 2, 30, 9000))).toBe(true);
    expect(progress.keeps(levelRecord('l1', 1, 9, 1000))).toBe(false);

    // On equal stars, fewer moves win. On equal moves, less time wins (DS-4).
    progress.recordLevel(levelRecord('l1', 2, 20, 9000));
    progress.recordLevel(levelRecord('l1', 2, 20, 8000));
    expect(progress.keeps(levelRecord('l1', 2, 20, 8000))).toBe(true);
    expect(progress.keeps(levelRecord('l1', 2, 20, 9000))).toBe(false);
    expect(progress.keeps(levelRecord('l1', 2, 30, 9000))).toBe(false);

    // A worse result and a full tie keep the stored result (DS-12).
    progress.recordLevel(levelRecord('l1', 0, 5, 100));
    progress.recordLevel(levelRecord('l1', 2, 20, 8000));
    expect(progress.keeps(levelRecord('l1', 2, 20, 8000))).toBe(true);
    expect(progress.keeps(levelRecord('l1', 0, 5, 100))).toBe(false);
  });

  it('should_keep_one_result_per_level_when_results_of_two_levels_are_recorded', () => {
    const progress = GameProgress.start(gameId);

    progress.recordLevel(levelRecord('l1', 3, 10));
    progress.recordLevel(levelRecord('l2', 1, 40));
    progress.recordLevel(levelRecord('l2', 2, 50));

    expect(progress.keeps(levelRecord('l1', 3, 10))).toBe(true);
    expect(progress.keeps(levelRecord('l2', 2, 50))).toBe(true);
    expect(progress.keeps(levelRecord('l2', 1, 40))).toBe(false);
    // A level result is not the high score, and a high score is not a level result.
    expect(progress.keeps(highScore(0))).toBe(false);
  });

  // A progress is an entity (classes.md decision 52): its identity is the id of its game.
  it('should_equal_a_progress_of_the_same_game_when_they_keep_other_records', () => {
    const progress = GameProgress.start(gameId);
    progress.recordScore(highScore(5));

    expect(progress.equals(GameProgress.start(GameId.of('fake-game')))).toBe(true);
    expect(progress.equals(GameProgress.start(GameId.of('other-game')))).toBe(false);
  });
});

// Done when of issue #156: a test records two results in each model, and the best one stays.
describe('HighScoreProgress', () => {
  const result = (score: number, moves: number) =>
    GameResult.of({ gameId, score: Score.of(score), moves: Moves.of(moves) });

  it('should_keep_the_higher_high_score_when_the_model_records_two_results', () => {
    const model = new HighScoreProgress();
    const higherLast = GameProgress.start(gameId);
    const higherFirst = GameProgress.start(gameId);

    model.record(result(35, 2), higherLast);
    model.record(result(36, 4), higherLast);
    model.record(result(36, 4), higherFirst);
    model.record(result(35, 2), higherFirst);

    for (const progress of [higherLast, higherFirst]) {
      expect(progress.keeps(highScore(36))).toBe(true);
      expect(progress.keeps(highScore(35))).toBe(false);
    }
  });
});

describe('LevelProgress', () => {
  // The star rule of a test level: three stars for 10 moves or fewer, and one star above.
  // The level has no time limit, so the time gives no star.
  class TenMovesForThreeStars implements ILevelStars {
    starsFor(moves: Moves): Stars {
      return moves.isFewerThan(Moves.of(11)) ? Stars.of(3) : Stars.of(1);
    }
  }
  const result = (moves: number, ms: number) =>
    GameResult.of({
      gameId,
      score: Score.of(0),
      moves: Moves.of(moves),
      levelId: LevelId.of('l1'),
      elapsedMs: ElapsedTime.ofMs(ms),
    });

  it('should_keep_the_best_result_of_the_level_when_the_model_records_two_results', () => {
    const model = new LevelProgress(new TenMovesForThreeStars());
    const progress = GameProgress.start(gameId);

    // More stars win.
    model.record(result(8, 9000), progress);
    model.record(result(20, 1000), progress);
    expect(progress.keeps(levelRecord('l1', 3, 8, 9000))).toBe(true);
    expect(progress.keeps(levelRecord('l1', 1, 20, 1000))).toBe(false);

    // On equal stars, fewer moves win, and then less time.
    model.record(result(7, 9500), progress);
    model.record(result(7, 6000), progress);
    expect(progress.keeps(levelRecord('l1', 3, 7, 6000))).toBe(true);
    expect(progress.keeps(levelRecord('l1', 3, 7, 9500))).toBe(false);
    expect(progress.keeps(levelRecord('l1', 3, 8, 9000))).toBe(false);
  });
});
