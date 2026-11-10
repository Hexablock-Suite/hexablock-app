/** @jest-environment node */
import { Moves } from '../../../../src/domain/engine/moves';
import { Stars } from '../../../../src/domain/engine/stars';
import {
  SortPlay,
  SortStarThreshold,
  sortStars,
} from '../../../../src/domain/variants/hexa-sort/sort-stars';

// The Sort stars of D22, the accepted rule of issue #59: a won Sort level gets stars by moves.
// Each star has one threshold, a move count. The stars are cumulative: star N needs star N-1.
// The play, the threshold and the stars are value objects (issue #204).

// A play of `moves` moves.
const play = (moves: number) => SortPlay.of(Moves.of(moves));

// One star threshold: at most `maxMoves` moves.
const star = (maxMoves: number) => SortStarThreshold.of(Moves.of(maxMoves));

// Three stars, from the easiest to the hardest: 30, 20 and 10 moves.
const THREE_STARS: readonly SortStarThreshold[] = [star(30), star(20), star(10)];

// A threshold is a value object, and it tells whether a play meets it.
describe('SortStarThreshold', () => {
  it('should_be_met_when_the_play_meets_the_limit_exactly', () => {
    expect(star(10).isMetBy(play(10))).toBe(true);
    expect(star(10).isMetBy(play(0))).toBe(true);
  });

  it('should_be_missed_when_the_play_passes_the_limit_by_one_move', () => {
    expect(star(10).isMetBy(play(11))).toBe(false);
  });

  it('should_be_equal_in_both_directions_when_two_thresholds_hold_the_same_limit', () => {
    const first = star(10);
    const second = star(10);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(star(11)), star(11).equals(first)]).toEqual([false, false]);
  });
});

describe('SortPlay', () => {
  it('should_be_equal_in_both_directions_when_two_plays_hold_the_same_moves', () => {
    const first = play(10);
    const second = play(10);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(play(11)), play(11).equals(first)]).toEqual([false, false]);
  });
});

describe('sortStars', () => {
  it('should_give_every_star_when_the_play_meets_every_threshold', () => {
    expect(sortStars(play(9), THREE_STARS)).toEqual(Stars.of(3));
  });

  it('should_give_a_stars_value_object_when_the_stars_are_counted', () => {
    expect(sortStars(play(9), THREE_STARS)).toBeInstanceOf(Stars);
    expect(sortStars(play(9), THREE_STARS).equals(Stars.of(3))).toBe(true);
  });

  it('should_give_no_star_when_the_play_meets_no_threshold', () => {
    expect(sortStars(play(31), THREE_STARS)).toEqual(Stars.of(0));
  });

  it('should_give_the_star_when_the_moves_equal_its_threshold', () => {
    expect(sortStars(play(30), THREE_STARS)).toEqual(Stars.of(1));
    expect(sortStars(play(20), THREE_STARS)).toEqual(Stars.of(2));
    expect(sortStars(play(10), THREE_STARS)).toEqual(Stars.of(3));
  });

  it('should_give_no_star_when_the_play_meets_star_two_but_not_star_one', () => {
    const stars: readonly SortStarThreshold[] = [star(10), star(20)];

    expect(sortStars(play(15), stars)).toEqual(Stars.of(0));
  });

  it('should_stop_at_the_first_missed_star_when_a_later_star_is_met', () => {
    const stars: readonly SortStarThreshold[] = [star(20), star(10), star(30)];

    expect(sortStars(play(15), stars)).toEqual(Stars.of(1));
  });

  it('should_give_no_star_when_the_level_has_no_threshold', () => {
    expect(sortStars(play(0), [])).toEqual(Stars.of(0));
  });

  // Issue 137: NaN fails every comparison, so without the check `moves: NaN` wins every star.
  // `Moves` holds the check, so no play holds a count that no game gives.
  it('should_throw_a_range_error_when_the_moves_are_not_a_safe_integer_of_zero_or_more', () => {
    const played = (moves: number) => () => sortStars(play(moves), THREE_STARS);

    for (const moves of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(played(moves)).toThrow(RangeError);
      expect(played(moves)).toThrow(
        `A move count needs a whole number of 0 or more, not ${moves}.`,
      );
    }
    // A level without thresholds still checks the moves.
    expect(() => sortStars(play(Number.NaN), [])).toThrow(RangeError);
    // -0 counts as 0. The largest safe integer is a valid count.
    expect(played(0)()).toEqual(Stars.of(3));
    expect(played(-0)()).toEqual(Stars.of(3));
    expect(played(Number.MAX_SAFE_INTEGER)()).toEqual(Stars.of(0));
  });
});
