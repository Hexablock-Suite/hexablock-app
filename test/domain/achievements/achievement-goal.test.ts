/** @jest-environment node */
import {
  EveryLevelWon,
  LevelsWon,
  type AchievementGoal,
} from '../../../src/domain/achievements/achievement-goal';
import { GameId } from '../../../src/domain/shared/game-id';
import { GameProgress } from '../../../src/domain/progress/game-progress';
import { LevelDefinition } from '../../../src/domain/progress/level-definition';
import { LevelId } from '../../../src/domain/progress/level-id';
import { ProgressRecord } from '../../../src/domain/progress/progress-model';
import { Score } from '../../../src/domain/shared/score';
import { Stars } from '../../../src/domain/progress/stars';

// The goals of the achievements live in the domain (issue #326, classes.md decision 60).
// A goal receives the levels and the progress that the use case loaded, and it calls
// no repository. A level is won when `LevelStatus.ofEach()` gives it `completed`.

const FIT = GameId.of('hexa-fit');

const level = (id: string, order: number, topology = 'hex') =>
  LevelDefinition.of({ levelId: id, order, topology, section: {} });

// Four levels of Fit on two figures: a goal counts the levels of every figure.
const fourLevels = [level('f1', 1), level('f2', 2), level('f3', 3), level('fs1', 1, 'square')];

// A Fit progress that keeps a result with `stars` stars for each level of `won`.
function progressWith(won: readonly string[], stars = 3): GameProgress {
  const progress = GameProgress.start(FIT);
  for (const levelId of won) {
    progress.recordLevel(
      ProgressRecord.of({
        gameId: FIT,
        score: Score.of(0),
        levelId: LevelId.of(levelId),
        stars: Stars.of(stars),
      }),
    );
  }
  return progress;
}

describe('LevelsWon', () => {
  it('should_be_reached_when_the_progress_keeps_that_many_won_levels_of_any_figure', () => {
    const goal: AchievementGoal = LevelsWon.of(FIT, 3);

    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f3']))).toBe(false);
    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f3', 'fs1'], 0))).toBe(true);
  });

  it('should_not_be_reached_when_the_game_has_no_progress', () => {
    expect(LevelsWon.of(FIT, 1).isReachedBy(fourLevels, undefined)).toBe(false);
  });

  // A result of a level that the game does not list counts for nothing.
  it('should_not_be_reached_when_the_game_has_no_levels', () => {
    expect(LevelsWon.of(FIT, 1).isReachedBy([], progressWith(['f1', 'f2']))).toBe(false);
  });

  it('should_throw_a_range_error_when_the_count_is_not_a_whole_number_of_1_or_more', () => {
    for (const count of [0, -1, 2.5, Number.NaN]) {
      let caught: unknown;
      try {
        LevelsWon.of(FIT, count);
      } catch (error) {
        caught = error;
      }

      expect(caught).toEqual(
        new RangeError('A count of won levels needs a whole number of 1 or more.'),
      );
      expect((caught as Error).cause).toBe(count);
    }
  });

  // The use case loads the levels and the progress of the game that the goal names.
  it('should_name_its_game_when_the_use_case_asks_for_it', () => {
    expect(LevelsWon.of(FIT, 3).gameId().equals(FIT)).toBe(true);
  });
});

describe('EveryLevelWon', () => {
  it('should_be_reached_only_when_each_level_of_every_figure_is_won', () => {
    const goal: AchievementGoal = new EveryLevelWon(FIT);

    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f2', 'f3']))).toBe(false);
    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f2', 'f3', 'fs1'], 0))).toBe(true);
  });

  it('should_not_be_reached_when_the_game_has_no_progress', () => {
    expect(new EveryLevelWon(FIT).isReachedBy(fourLevels, undefined)).toBe(false);
  });

  it('should_not_be_reached_when_the_game_has_no_levels', () => {
    expect(new EveryLevelWon(FIT).isReachedBy([], progressWith(['f1']))).toBe(false);
    expect(new EveryLevelWon(FIT).isReachedBy([], undefined)).toBe(false);
  });

  it('should_name_its_game_when_the_use_case_asks_for_it', () => {
    expect(new EveryLevelWon(FIT).gameId().equals(FIT)).toBe(true);
  });
});
