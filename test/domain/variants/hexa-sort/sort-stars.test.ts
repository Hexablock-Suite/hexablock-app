/** @jest-environment node */
import {
  sortStars,
  type SortStarThreshold,
} from '../../../../src/domain/variants/hexa-sort/sort-stars';

// The Sort stars of D22, the accepted rule of issue #59: a won Sort level gets stars by moves.
// Each star has one threshold, a move count. The stars are cumulative: star N needs star N-1.

// Three stars, from the easiest to the hardest: 30, 20 and 10 moves.
const THREE_STARS: readonly SortStarThreshold[] = [
  { maxMoves: 30 },
  { maxMoves: 20 },
  { maxMoves: 10 },
];

describe('sortStars', () => {
  it('should_give_every_star_when_the_play_meets_every_threshold', () => {
    expect(sortStars({ moves: 9 }, THREE_STARS)).toBe(3);
  });

  it('should_give_no_star_when_the_play_meets_no_threshold', () => {
    expect(sortStars({ moves: 31 }, THREE_STARS)).toBe(0);
  });

  it('should_give_the_star_when_the_moves_equal_its_threshold', () => {
    expect(sortStars({ moves: 30 }, THREE_STARS)).toBe(1);
    expect(sortStars({ moves: 20 }, THREE_STARS)).toBe(2);
    expect(sortStars({ moves: 10 }, THREE_STARS)).toBe(3);
  });

  it('should_give_no_star_when_the_play_meets_star_two_but_not_star_one', () => {
    const stars: readonly SortStarThreshold[] = [{ maxMoves: 10 }, { maxMoves: 20 }];

    expect(sortStars({ moves: 15 }, stars)).toBe(0);
  });

  it('should_stop_at_the_first_missed_star_when_a_later_star_is_met', () => {
    const stars: readonly SortStarThreshold[] = [
      { maxMoves: 20 },
      { maxMoves: 10 },
      { maxMoves: 30 },
    ];

    expect(sortStars({ moves: 15 }, stars)).toBe(1);
  });

  it('should_give_no_star_when_the_level_has_no_threshold', () => {
    expect(sortStars({ moves: 0 }, [])).toBe(0);
  });

  // Issue 137: NaN fails every comparison, so without the check `moves: NaN` wins every star.
  // The check and its message are the ones of `fitStars`.
  it('should_throw_a_range_error_when_the_moves_are_not_a_safe_integer_of_zero_or_more', () => {
    const played = (moves: number) => () => sortStars({ moves }, THREE_STARS);

    for (const moves of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(played(moves)).toThrow(RangeError);
      expect(played(moves)).toThrow(
        `A move count needs a whole number of 0 or more, not ${moves}.`,
      );
    }
    // A level without thresholds still checks the moves.
    expect(() => sortStars({ moves: Number.NaN }, [])).toThrow(RangeError);
    // -0 counts as 0. The largest safe integer is a valid count.
    expect(played(0)()).toBe(3);
    expect(played(-0)()).toBe(3);
    expect(played(Number.MAX_SAFE_INTEGER)()).toBe(0);
  });
});
