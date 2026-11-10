/** @jest-environment node */
import { ElapsedTime } from '../../../../src/domain/engine/elapsed-time';
import { Moves } from '../../../../src/domain/engine/moves';
import { Score } from '../../../../src/domain/engine/score';
import { Stars } from '../../../../src/domain/engine/stars';
import { Board } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import { Piece } from '../../../../src/domain/engine/piece';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { Turns } from '../../../../src/domain/engine/turns';
import { PlaceFitPiece, type FitMove } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { FitRules } from '../../../../src/domain/variants/hexa-fit/fit-rules';
import {
  FIT_POINTS_PER_TURN,
  FitScoring,
} from '../../../../src/domain/variants/hexa-fit/fit-scoring';
import {
  FitPlay,
  FitStarThreshold,
  fitStars,
} from '../../../../src/domain/variants/hexa-fit/fit-stars';
import { FitState } from '../../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { RecordingPublisher } from '../../../support/engine/fake-game';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// The Fit scoring of issue #98. It codes the accepted rule of issue #59 (D22):
// no points per turn, and a star needs both of its thresholds (moves and time).
// The stars are cumulative: star N needs star N-1 (gap G110.5).
// `Moves` and `ElapsedTime` reject a move count or a time that no play gives (gaps G110.1 and G110.2).
// The rules count the moves (issue #60), and their suite tests the count.

const A = PieceId.of('a');
const B = PieceId.of('b');
const NO_TURN = Turns.of(0);

// A 2 × 2 square figure and two horizontal dominoes: they cover it exactly.
function dominoLevel(): FitState<SquareCoord> {
  const domino = [square(0, 0), square(1, 0)];
  const piece = (id: PieceId) => new Piece(new ShapeGroup(domino.map((c) => new CellNode(c))), id);
  return FitState.start(
    STATE_ID,
    MATCH_ID,
    new Board<PieceId, SquareCoord, string>(
      BOARD_ID,
      squareTopology.region(RegionSize.of(2)),
      squareTopology,
    ),
    new FixedListPieceSource([piece(A), piece(B)]),
  );
}

// A play of `moves` moves and `ms` milliseconds.
const play = (moves: number, ms: number) =>
  FitPlay.of({ moves: Moves.of(moves), elapsedMs: ElapsedTime.ofMs(ms) });

// One star threshold: at most `maxMoves` moves and at most `maxMs` milliseconds.
const star = (maxMoves: number, maxMs: number) =>
  FitStarThreshold.of({ maxMoves: Moves.of(maxMoves), maxElapsedMs: ElapsedTime.ofMs(maxMs) });

// One star: at most 10 moves and at most 60 seconds.
const ONE_STAR = [star(10, 60_000)];

describe('FitScoring', () => {
  it('should_score_no_points_when_the_turns_win_the_level', () => {
    const engine = new GameEngine<
      PieceId,
      SquareCoord,
      FitMove<SquareCoord>,
      FitState<SquareCoord>
    >(
      MATCH_ID,
      GameId.of('hexa-fit'),
      new FitRules<SquareCoord>(),
      new FitScoring<SquareCoord>(),
      new RecordingPublisher(),
    );
    engine.start(dominoLevel());

    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));
    const outcome = engine.play(new PlaceFitPiece(B, NO_TURN, square(0, 1)));

    expect(outcome).toBe('victory');
    expect(FIT_POINTS_PER_TURN).toBe(0);
    expect(engine.snapshot().score).toEqual(Score.of(0));
  });
});

// A threshold is a value object, and it tells whether a play meets it (issue #204).
describe('FitStarThreshold', () => {
  it('should_be_met_when_the_play_meets_both_limits_exactly', () => {
    expect(star(10, 60_000).isMetBy(play(10, 60_000))).toBe(true);
    expect(star(10, 60_000).isMetBy(play(0, 0))).toBe(true);
  });

  it('should_be_missed_when_the_play_passes_the_moves_by_one_move', () => {
    expect(star(10, 60_000).isMetBy(play(11, 60_000))).toBe(false);
  });

  it('should_be_missed_when_the_play_passes_the_time_by_one_millisecond', () => {
    expect(star(10, 60_000).isMetBy(play(10, 60_001))).toBe(false);
  });

  it('should_be_equal_in_both_directions_when_two_thresholds_hold_the_same_limits', () => {
    const first = star(10, 60_000);
    const second = star(10, 60_000);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(star(11, 60_000)), star(11, 60_000).equals(first)]).toEqual([
      false,
      false,
    ]);
    expect([first.equals(star(10, 60_001)), star(10, 60_001).equals(first)]).toEqual([
      false,
      false,
    ]);
  });
});

describe('FitPlay', () => {
  it('should_be_equal_in_both_directions_when_two_plays_hold_the_same_moves_and_time', () => {
    const first = play(10, 60_000);
    const second = play(10, 60_000);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(play(11, 60_000)), play(11, 60_000).equals(first)]).toEqual([
      false,
      false,
    ]);
    expect([first.equals(play(10, 60_001)), play(10, 60_001).equals(first)]).toEqual([
      false,
      false,
    ]);
  });
});

describe('fitStars', () => {
  it('should_give_the_star_when_the_moves_and_the_time_meet_both_thresholds', () => {
    expect(fitStars(play(10, 60_000), ONE_STAR)).toEqual(Stars.of(1));
  });

  it('should_give_a_stars_value_object_when_the_stars_are_counted', () => {
    expect(fitStars(play(10, 60_000), ONE_STAR)).toBeInstanceOf(Stars);
    expect(fitStars(play(10, 60_000), ONE_STAR).equals(Stars.of(1))).toBe(true);
  });

  it('should_give_no_star_when_only_the_moves_meet_the_threshold', () => {
    expect(fitStars(play(10, 60_001), ONE_STAR)).toEqual(Stars.of(0));
  });

  it('should_give_no_star_when_only_the_time_meets_the_threshold', () => {
    expect(fitStars(play(11, 60_000), ONE_STAR)).toEqual(Stars.of(0));
  });

  it('should_give_no_star_when_neither_threshold_is_met', () => {
    expect(fitStars(play(11, 60_001), ONE_STAR)).toEqual(Stars.of(0));
  });

  it('should_count_each_star_whose_two_thresholds_are_met_when_the_level_has_three_stars', () => {
    const threeStars = [star(20, 120_000), star(12, 90_000), star(8, 30_000)];

    expect(fitStars(play(10, 60_000), threeStars)).toEqual(Stars.of(2));
  });

  it('should_give_no_star_when_the_level_lists_no_threshold', () => {
    // A level with no star gives 0, even for a perfect play.
    expect(fitStars(play(0, 0), [])).toEqual(Stars.of(0));
  });

  it('should_give_no_star_when_the_play_meets_star_two_but_not_star_one', () => {
    // Gap G110.5: the thresholds cross. An independent count gives 1 star here.
    const byMoves = [star(10, 30_000), star(20, 60_000)];
    const byTime = [star(20, 30_000), star(20, 60_000)];

    expect(fitStars(play(15, 45_000), byMoves)).toEqual(Stars.of(0));
    expect(fitStars(play(10, 45_000), byTime)).toEqual(Stars.of(0));
  });

  it('should_stop_at_the_first_missed_star_when_a_later_star_is_met', () => {
    const stars = [star(20, 120_000), star(10, 30_000), star(30, 120_000)];

    expect(fitStars(play(15, 60_000), stars)).toEqual(Stars.of(1));
  });

  // `Moves` checks the count, so no play holds a count that no game gives (issue #137).
  it('should_throw_a_range_error_when_the_moves_are_not_a_safe_integer_of_zero_or_more', () => {
    const played = (moves: number) => () => fitStars(play(moves, 0), ONE_STAR);

    for (const moves of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(played(moves)).toThrow(RangeError);
      expect(played(moves)).toThrow(
        `A move count needs a whole number of 0 or more, not ${moves}.`,
      );
    }
    // -0 counts as 0. The largest safe integer is a valid count.
    expect(played(0)()).toEqual(Stars.of(1));
    expect(played(-0)()).toEqual(Stars.of(1));
    expect(played(Number.MAX_SAFE_INTEGER)()).toEqual(Stars.of(0));
  });

  // `ElapsedTime` checks the time. Before issue #204 a time could be decimal.
  it('should_throw_a_range_error_when_the_elapsed_time_is_not_a_safe_integer_of_zero_or_more', () => {
    const played = (elapsedMs: number) => () => fitStars(play(0, elapsedMs), ONE_STAR);

    for (const elapsedMs of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
      expect(played(elapsedMs)).toThrow(RangeError);
      expect(played(elapsedMs)).toThrow(
        `An elapsed time needs a whole number of milliseconds of 0 or more, not ${elapsedMs}.`,
      );
    }
    // -0 counts as 0. The largest safe integer is a valid time.
    expect(played(0)()).toEqual(Stars.of(1));
    expect(played(-0)()).toEqual(Stars.of(1));
    expect(played(Number.MAX_SAFE_INTEGER)()).toEqual(Stars.of(0));
  });

  it('should_check_the_moves_and_the_time_when_the_level_lists_no_threshold', () => {
    expect(() => fitStars(play(-1, 0), [])).toThrow(RangeError);
    expect(() => fitStars(play(0, -1), [])).toThrow(RangeError);
  });
});
