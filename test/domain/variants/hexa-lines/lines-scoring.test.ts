/** @jest-environment node */
import { ScoringDecorator } from '../../../../src/domain/engine/scoring-decorator';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { ComboMultiplierDecorator } from '../../../../src/domain/variants/hexa-lines/combo-multiplier-decorator';
import { LinesScoring } from '../../../../src/domain/variants/hexa-lines/lines-scoring';
import type { LinesState } from '../../../../src/domain/variants/hexa-lines/lines-state';
import { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  linesFactory,
  linesGame,
  linesState,
  piece,
} from '../../../support/variants/hexa-lines/lines-game';

// The scoring of Hexa Lines (issue 97, APP-FR-06, statement §1.1).
// It codes the accepted rule of issue #59 (D22): 1 point per placed cell and 10 per cleared line, and the line bonus
// multiplied by `lines + streak - 1` through `ComboMultiplierDecorator`.
// The tests play through `GameEngine.play()`.

const origin = square(0, 0);
const one = piece(origin);

function decorated(): IScoringPolicy<LinesState<SquareCoord>> {
  return new ComboMultiplierDecorator(new LinesScoring<SquareCoord>());
}

// Two placements in a row that each clear one line: rows 0 and 1 of a 3 by 3 board.
function twoClearingPlacements(scoring: IScoringPolicy<LinesState<SquareCoord>>): number[] {
  const { engine } = linesGame(
    linesState(squareTopology, 3, {
      filled: [square(1, 0), square(2, 0), square(1, 1), square(2, 1)],
      tray: [one, one, one],
      source: [one, one, one],
    }),
    scoring,
  );
  engine.play(new PlacePiece(0, square(0, 0)));
  const first = engine.snapshot().score;
  engine.play(new PlacePiece(0, square(0, 1)));
  const second = engine.snapshot().score;
  engine.play(new PlacePiece(0, square(2, 2)));
  return [first, second, engine.snapshot().score];
}

// One placement at the origin that fills row 0 and column 0 together.
function comboPlacement(scoring: IScoringPolicy<LinesState<SquareCoord>>) {
  const { engine } = linesGame(
    linesState(squareTopology, 3, {
      filled: [square(1, 0), square(2, 0), square(0, 1), square(0, 2), square(2, 2)],
      tray: [one, one],
    }),
    scoring,
  );
  engine.play(new PlacePiece(0, origin));
  return engine.snapshot();
}

// A clearing placement, then a vertical domino at the origin that fills row 0 and column 0.
// So the second placement has a combo of 2 lines and a streak of 2.
function comboInAStreak(scoring: IScoringPolicy<LinesState<SquareCoord>>) {
  const domino = piece(origin, square(0, 1));
  const { engine } = linesGame(
    linesState(squareTopology, 3, {
      filled: [square(1, 1), square(2, 1), square(1, 0), square(2, 0), square(0, 2)],
      tray: [one, domino],
      source: [one],
    }),
    scoring,
  );
  engine.play(new PlacePiece(0, square(0, 1)));
  const first = engine.snapshot().score;
  engine.play(new PlacePiece(0, origin));
  return { first, state: engine.snapshot() };
}

describe('Hexa Lines scoring', () => {
  it('should_score_only_the_placed_cells_when_a_placement_clears_no_line', () => {
    const domino = piece(origin, square(1, 0));
    const { engine } = linesGame(
      linesState(squareTopology, 4, { tray: [domino, one] }),
      decorated(),
    );

    engine.play(new PlacePiece(0, square(1, 2)));

    const state = engine.snapshot();
    expect(state.linesCleared).toBe(0);
    expect(state.score).toBe(2);
  });

  it('should_add_ten_points_for_the_line_when_the_first_clearing_placement_clears_one_line', () => {
    const { engine } = linesGame(
      linesState(squareTopology, 3, { filled: [square(1, 0), square(2, 0)], tray: [one, one] }),
      decorated(),
    );

    engine.play(new PlacePiece(0, origin));

    const state = engine.snapshot();
    expect([state.linesCleared, state.streak]).toEqual([1, 1]);
    // 1 cell + 10 × 1 line × (1 + 1 - 1).
    expect(state.score).toBe(11);
  });

  it('should_multiply_the_line_bonus_by_the_combo_when_one_placement_clears_two_lines', () => {
    const state = comboPlacement(decorated());

    expect([state.linesCleared, state.streak]).toEqual([2, 1]);
    // 1 cell + 10 × 2 lines × (2 + 1 - 1).
    expect(state.score).toBe(41);
  });

  it('should_multiply_the_line_bonus_by_lines_plus_streak_minus_one_when_clearing_placements_follow_in_a_row', () => {
    // 11, then 1 + 10 × 1 × (1 + 2 - 1) = 21, then 1 cell with no line.
    expect(twoClearingPlacements(decorated())).toEqual([11, 32, 33]);
  });

  it('should_multiply_the_line_bonus_by_lines_plus_streak_minus_one_when_a_combo_follows_a_clearing_placement', () => {
    // Only a combo inside a streak tells `lines + streak - 1` (3) from `lines × streak` (4).
    const { first, state } = comboInAStreak(decorated());

    expect([state.linesCleared, state.streak, state.cellsPlaced]).toEqual([2, 2, 2]);
    // 11, then 2 cells + 10 × 2 lines × (2 + 2 - 1) = 62.
    expect([first, state.score]).toEqual([11, 73]);
    // The base scoring gives 2 cells + 10 × 2 lines = 22 for the same placement.
    expect(comboInAStreak(new LinesScoring<SquareCoord>()).state.score).toBe(33);
  });

  it('should_give_no_multiplier_when_the_base_lines_scoring_plays_alone', () => {
    const base = new LinesScoring<SquareCoord>();

    expect(comboPlacement(base).score).toBe(21);
    expect(twoClearingPlacements(base)).toEqual([11, 22, 23]);
  });

  it('should_wrap_the_base_scoring_as_a_scoring_policy_when_the_decorator_is_made', () => {
    const base = new LinesScoring<SquareCoord>();
    const scoring: IScoringPolicy<LinesState<SquareCoord>> = new ComboMultiplierDecorator(base);

    expect(scoring).toBeInstanceOf(ComboMultiplierDecorator);
    expect(comboPlacement(scoring).score).toBeGreaterThan(comboPlacement(base).score);
  });

  // The class views draw `ComboMultiplierDecorator extends ScoringDecorator` (issue 146).
  it('should_be_a_scoring_decorator_when_the_lines_factory_creates_the_scoring', () => {
    expect(linesFactory().createScoring()).toBeInstanceOf(ScoringDecorator);
  });
});
