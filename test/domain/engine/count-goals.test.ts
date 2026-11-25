/** @jest-environment node */
import { AchievementCount } from '../../../src/domain/engine/achievement-count';
import { AchievementCounters } from '../../../src/domain/engine/achievement-counters';
import {
  BestCountReached,
  TotalCountReached,
  type AchievementGoal,
} from '../../../src/domain/engine/achievement-goal';
import { GameId } from '../../../src/domain/engine/game-id';

// The goals that read the counters of the achievements (issue #364, part 4 of #277).
// A goal receives the counters that the use case loaded, and it calls no repository.
// The engine names no variant, so a goal reads a generic count: the composition root names
// the game and the number, for example «reach 256 in Hexa Merge».

const GAME = GameId.of('a-game');
const count = (value: number) => AchievementCount.of(value);

// Counters of `GAME` with the best count `best` and the total `total`.
function countersWith(best: number, total: number): AchievementCounters {
  const counters = AchievementCounters.start(GAME);
  counters.recordBest(count(best));
  counters.addToTotal(count(total));
  return counters;
}

// The error that `build` throws, or `undefined`.
function errorOf(build: () => unknown): unknown {
  try {
    build();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('BestCountReached', () => {
  it('should_be_reached_when_the_best_count_is_the_count_of_the_goal_or_above_it', () => {
    const goal: AchievementGoal = BestCountReached.of(GAME, count(256));

    expect(goal.isReachedBy([], undefined, countersWith(128, 999))).toBe(false);
    expect(goal.isReachedBy([], undefined, countersWith(256, 0))).toBe(true);
    expect(goal.isReachedBy([], undefined, countersWith(512, 0))).toBe(true);
  });

  it('should_not_be_reached_when_the_game_has_no_saved_counters', () => {
    expect(BestCountReached.of(GAME, count(3)).isReachedBy([], undefined, undefined)).toBe(false);
    expect(BestCountReached.of(GAME, count(3)).isReachedBy([], undefined)).toBe(false);
  });

  it('should_name_its_game_when_the_use_case_asks_for_it', () => {
    expect(BestCountReached.of(GAME, count(3)).gameId().equals(GAME)).toBe(true);
  });

  it('should_throw_a_range_error_when_the_count_of_the_goal_is_0', () => {
    const caught = errorOf(() => BestCountReached.of(GAME, count(0)));

    expect(caught).toEqual(
      new RangeError('The count of a goal needs a whole number of 1 or more.'),
    );
  });
});

describe('TotalCountReached', () => {
  it('should_be_reached_when_the_total_is_the_count_of_the_goal_or_above_it', () => {
    const goal: AchievementGoal = TotalCountReached.of(GAME, count(10));

    expect(goal.isReachedBy([], undefined, countersWith(999, 9))).toBe(false);
    expect(goal.isReachedBy([], undefined, countersWith(0, 10))).toBe(true);
    expect(goal.isReachedBy([], undefined, countersWith(0, 11))).toBe(true);
  });

  it('should_not_be_reached_when_the_game_has_no_saved_counters', () => {
    expect(TotalCountReached.of(GAME, count(10)).isReachedBy([], undefined, undefined)).toBe(false);
    expect(TotalCountReached.of(GAME, count(10)).isReachedBy([], undefined)).toBe(false);
  });

  it('should_name_its_game_when_the_use_case_asks_for_it', () => {
    expect(TotalCountReached.of(GAME, count(10)).gameId().equals(GAME)).toBe(true);
  });

  it('should_throw_a_range_error_when_the_count_of_the_goal_is_0', () => {
    const caught = errorOf(() => TotalCountReached.of(GAME, count(0)));

    expect(caught).toEqual(
      new RangeError('The count of a goal needs a whole number of 1 or more.'),
    );
  });
});
