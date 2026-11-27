/** @jest-environment node */
import { starsOf, type IStarThreshold } from '../../../src/domain/progress/star-count';
import { Stars } from '../../../src/domain/progress/stars';
import { Moves } from '../../../src/domain/shared/moves';

// One star count for every variant with levels (issue #424, D22, classes.md decision 36).
// The stars are cumulative: star N needs star N-1 (gap G110.5).
// The play of this test is a move count, and a threshold is met by a play of its limit or fewer.

// A threshold that a play of `maxMoves` moves or fewer meets.
const star = (maxMoves: number): IStarThreshold<Moves> => ({
  isMetBy: (play) => !Moves.of(maxMoves).isFewerThan(play),
});

const play = (moves: number) => Moves.of(moves);

describe('starsOf', () => {
  it('should_count_the_leading_thresholds_that_the_play_meets_when_the_level_has_thresholds', () => {
    const threeStars = [star(30), star(20), star(10)];

    expect(starsOf(play(9), threeStars)).toEqual(Stars.of(3));
    expect(starsOf(play(20), threeStars)).toEqual(Stars.of(2));
    expect(starsOf(play(30), threeStars)).toEqual(Stars.of(1));
    expect(starsOf(play(31), threeStars)).toEqual(Stars.of(0));
  });

  it('should_give_a_stars_value_object_when_the_stars_are_counted', () => {
    const counted = starsOf(play(9), [star(10)]);

    expect(counted).toBeInstanceOf(Stars);
    expect(counted.equals(Stars.of(1))).toBe(true);
  });

  it('should_give_no_star_when_the_level_lists_no_threshold', () => {
    expect(starsOf(play(0), [])).toEqual(Stars.of(0));
  });

  it('should_stop_at_the_first_missed_star_when_a_later_star_is_met', () => {
    expect(starsOf(play(15), [star(20), star(10), star(30)])).toEqual(Stars.of(1));
    expect(starsOf(play(15), [star(10), star(20)])).toEqual(Stars.of(0));
  });
});
