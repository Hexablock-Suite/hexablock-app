/** @jest-environment node */
import { AchievementCount } from '../../../src/domain/achievements/achievement-count';
import { AchievementCounters } from '../../../src/domain/achievements/achievement-counters';
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
// Issue #406: the four goals have a private constructor and `of()`, and `isReachedBy()` always
// gets the counters of the game. A game with no saved counters gets new counters.

const FIT = GameId.of('hexa-fit');
const count = (value: number) => AchievementCount.of(value);
// The counters of a game with no saved counters: the goals of the levels ignore them.
const NEW_COUNTERS = AchievementCounters.start(FIT);

const level = (id: string, order: number, topology = 'hex') =>
  LevelDefinition.of({ levelId: id, order, version: 1, topology, section: {} });

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
    const goal: AchievementGoal = LevelsWon.of(FIT, count(3));

    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f3']), NEW_COUNTERS)).toBe(false);
    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f3', 'fs1'], 0), NEW_COUNTERS)).toBe(
      true,
    );
  });

  it('should_not_be_reached_when_the_game_has_no_progress', () => {
    expect(LevelsWon.of(FIT, count(1)).isReachedBy(fourLevels, undefined, NEW_COUNTERS)).toBe(
      false,
    );
  });

  // A result of a level that the game does not list counts for nothing.
  it('should_not_be_reached_when_the_game_has_no_levels', () => {
    expect(
      LevelsWon.of(FIT, count(1)).isReachedBy([], progressWith(['f1', 'f2']), NEW_COUNTERS),
    ).toBe(false);
  });

  // An `AchievementCount` is a whole number of 0 or more, so 0 is the one count left to refuse.
  it('should_throw_a_range_error_when_the_count_is_not_a_whole_number_of_1_or_more', () => {
    const zero = count(0);
    let caught: unknown;
    try {
      LevelsWon.of(FIT, zero);
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(
      new RangeError('A count of won levels needs a whole number of 1 or more.'),
    );
    expect((caught as Error).cause).toBe(zero);
  });

  // The use case loads the levels and the progress of the game that the goal names.
  it('should_name_its_game_when_the_use_case_asks_for_it', () => {
    expect(LevelsWon.of(FIT, count(3)).gameId().equals(FIT)).toBe(true);
  });
});

describe('EveryLevelWon', () => {
  it('should_be_reached_only_when_each_level_of_every_figure_is_won', () => {
    const goal: AchievementGoal = EveryLevelWon.of(FIT);

    expect(goal.isReachedBy(fourLevels, progressWith(['f1', 'f2', 'f3']), NEW_COUNTERS)).toBe(
      false,
    );
    expect(
      goal.isReachedBy(fourLevels, progressWith(['f1', 'f2', 'f3', 'fs1'], 0), NEW_COUNTERS),
    ).toBe(true);
  });

  it('should_not_be_reached_when_the_game_has_no_progress', () => {
    expect(EveryLevelWon.of(FIT).isReachedBy(fourLevels, undefined, NEW_COUNTERS)).toBe(false);
  });

  it('should_not_be_reached_when_the_game_has_no_levels', () => {
    expect(EveryLevelWon.of(FIT).isReachedBy([], progressWith(['f1']), NEW_COUNTERS)).toBe(false);
    expect(EveryLevelWon.of(FIT).isReachedBy([], undefined, NEW_COUNTERS)).toBe(false);
  });

  it('should_name_its_game_when_the_use_case_asks_for_it', () => {
    expect(EveryLevelWon.of(FIT).gameId().equals(FIT)).toBe(true);
  });
});
