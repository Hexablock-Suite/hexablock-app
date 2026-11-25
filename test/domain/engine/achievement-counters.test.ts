/** @jest-environment node */
import { AchievementCount } from '../../../src/domain/engine/achievement-count';
import { AchievementCounters } from '../../../src/domain/engine/achievement-counters';
import { GameId } from '../../../src/domain/engine/game-id';
import { countersContentOf } from '../../support/engine/counters-content';
import { delivered } from '../../support/engine/value-receiver';

// Issue #363 (part 3 of #277): the counters of the achievements of one game.
// The best count keeps the highest count of one move, such as the most lines at once or the
// highest tile. The total adds each count, such as the goals of every Sort game.

const LINES = GameId.of('hexa-lines');
const count = (value: number) => AchievementCount.of(value);

describe('AchievementCount', () => {
  it('should_refuse_the_value_when_it_is_not_a_whole_number_of_0_or_more', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => AchievementCount.of(value)).toThrow(
        new RangeError(
          `A count of an achievement needs a whole number of 0 or more, not ${value}.`,
        ),
      );
    }
  });

  it('should_give_the_sum_and_compare_by_value_when_two_counts_meet', () => {
    expect(delivered(count(3).plus(count(4)))).toBe(7);
    expect(count(3).equals(count(3))).toBe(true);
    expect(count(3).isAtLeast(count(3))).toBe(true);
    expect(count(2).isAtLeast(count(3))).toBe(false);
    expect(delivered(AchievementCount.of(-0))).toBe(0);
    expect(Object.is(delivered(AchievementCount.of(-0)), 0)).toBe(true);
  });
});

describe('AchievementCounters', () => {
  it('should_start_with_a_best_and_a_total_of_zero_when_the_counters_of_a_game_start', () => {
    const counters = AchievementCounters.start(LINES);

    expect(countersContentOf(counters)).toEqual({ gameId: LINES, best: 0, total: 0 });
    expect(counters.bestReaches(count(1))).toBe(false);
    expect(counters.totalReaches(count(0))).toBe(true);
  });

  it('should_keep_the_highest_best_when_a_lower_count_is_recorded_after_it', () => {
    const counters = AchievementCounters.start(LINES);

    counters.recordBest(count(2));
    counters.recordBest(count(3));
    counters.recordBest(count(1));

    expect(countersContentOf(counters)).toEqual({ gameId: LINES, best: 3, total: 0 });
    expect(counters.bestReaches(count(3))).toBe(true);
    expect(counters.bestReaches(count(4))).toBe(false);
  });

  it('should_add_each_count_to_the_total_when_counts_are_added', () => {
    const counters = AchievementCounters.start(GameId.of('hexa-sort'));

    counters.addToTotal(count(1));
    counters.addToTotal(count(2));

    expect(countersContentOf(counters).total).toBe(3);
    expect(counters.totalReaches(count(3))).toBe(true);
    expect(counters.totalReaches(count(4))).toBe(false);
  });

  it('should_be_equal_when_two_counters_belong_to_one_game', () => {
    const first = AchievementCounters.start(LINES);
    first.recordBest(count(3));

    expect(first.equals(AchievementCounters.start(LINES))).toBe(true);
    expect(first.equals(AchievementCounters.start(GameId.of('hexa-merge')))).toBe(false);
  });
});
