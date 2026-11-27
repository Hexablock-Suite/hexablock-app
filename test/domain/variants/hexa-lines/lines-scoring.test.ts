/** @jest-environment node */
import { Score } from '../../../../src/domain/shared/score';
import { ScoringDecorator } from '../../../../src/domain/engine/scoring-decorator';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { CellCount } from '../../../../src/domain/variants/hexa-lines/cell-count';
import { ComboMultiplierDecorator } from '../../../../src/domain/variants/hexa-lines/combo-multiplier-decorator';
import { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';
import { LinesScoring } from '../../../../src/domain/variants/hexa-lines/lines-scoring';
import type { LinesState } from '../../../../src/domain/variants/hexa-lines/lines-state';
import { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { Streak } from '../../../../src/domain/variants/hexa-lines/streak';
import { TrayPosition } from '../../../../src/domain/variants/hexa-lines/tray-position';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  linesFactory,
  linesGame,
  linesState,
  piece,
} from '../../../support/variants/hexa-lines/lines-game';
import { playMove } from '../../../support/engine/play-move';

// The scoring of Hexa Lines (issue 97, APP-FR-06, statement §1.1).
// It codes the accepted rule of issue #59 (D22): 1 point per placed cell and 10 per cleared line, and the line bonus
// multiplied by `lines + streak - 1` through `ComboMultiplierDecorator`.
// The tests play through `GameEngine.tryPlay()`.

const origin = square(0, 0);
const one = piece(origin);

function decorated(): IScoringPolicy<LinesState<SquareCoord>> {
  return new ComboMultiplierDecorator(new LinesScoring<SquareCoord>());
}

// Two placements in a row that each clear one line: rows 0 and 1 of a 3 by 3 board.
function twoClearingPlacements(scoring: IScoringPolicy<LinesState<SquareCoord>>): Score[] {
  const { engine } = linesGame(
    linesState(squareTopology, 3, {
      filled: [square(1, 0), square(2, 0), square(1, 1), square(2, 1)],
      tray: [one, one, one],
      source: [one, one, one],
    }),
    scoring,
  );
  playMove(engine, new PlacePiece(TrayPosition.of(0), square(0, 0)));
  const first = engine.snapshot().scoreSoFar();
  playMove(engine, new PlacePiece(TrayPosition.of(0), square(0, 1)));
  const second = engine.snapshot().scoreSoFar();
  playMove(engine, new PlacePiece(TrayPosition.of(0), square(2, 2)));
  return [first, second, engine.snapshot().scoreSoFar()];
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
  playMove(engine, new PlacePiece(TrayPosition.of(0), origin));
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
  playMove(engine, new PlacePiece(TrayPosition.of(0), square(0, 1)));
  const first = engine.snapshot().scoreSoFar();
  playMove(engine, new PlacePiece(TrayPosition.of(0), origin));
  return { first, state: engine.snapshot() };
}

describe('Hexa Lines scoring', () => {
  it('should_score_only_the_placed_cells_when_a_placement_clears_no_line', () => {
    const domino = piece(origin, square(1, 0));
    const { engine } = linesGame(
      linesState(squareTopology, 4, { tray: [domino, one] }),
      decorated(),
    );

    playMove(engine, new PlacePiece(TrayPosition.of(0), square(1, 2)));

    const state = engine.snapshot();
    expect(state.lastCombo()).toEqual(LineCount.of(0));
    expect(state.scoreSoFar()).toEqual(Score.of(2));
  });

  // The photo keeps its fields private (issue #245), so the test builds a state with the facts
  // of the placement and takes its photo.
  // With no cleared line the factor `lines + streak - 1` is 0 or less, and the decorator
  // adds nothing: it gives the score of the base policy (issue #203).
  it('should_give_the_base_score_when_the_decorator_scores_a_placement_that_clears_no_line', () => {
    const base = new LinesScoring<SquareCoord>();

    for (const streak of [0, 1, 3]) {
      const after = linesState(squareTopology, 1, {
        tray: [],
        cellsPlaced: CellCount.of(3),
        linesCleared: LineCount.of(0),
        streak: Streak.of(streak),
      }).snapshot();

      expect(new ComboMultiplierDecorator(base).score(after, after)).toEqual(Score.of(3));
      expect(base.score(after, after)).toEqual(Score.of(3));
    }
  });

  // The line bonus is private (issue #427): the base policy gives it inside `score()`.
  it('should_give_the_line_bonus_as_a_score_when_the_base_policy_reads_the_cleared_lines', () => {
    const photoOf = (lines: number) =>
      linesState(squareTopology, 1, { tray: [], linesCleared: LineCount.of(lines) }).snapshot();
    const base = new LinesScoring<SquareCoord>();

    expect(base.score(photoOf(2), photoOf(2))).toEqual(Score.of(20));
    expect(base.score(photoOf(0), photoOf(0))).toEqual(Score.of(0));
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_asks_the_base_policy_for_the_line_bonus', () => {
    const photo = linesState(squareTopology, 1, { tray: [] }).snapshot();
    const readers = [
      // @ts-expect-error `LinesScoring.lineBonus()` is private (issue #427).
      () => new LinesScoring<SquareCoord>().lineBonus(photo),
    ];

    expect(readers).toHaveLength(1);
  });

  // The decorator reads no member of `LinesScoring`, so it binds no inner type (issue #427).
  // It wraps any scoring policy of the Lines state and adds the combo bonus to its score.
  it('should_add_the_combo_bonus_to_any_inner_policy_when_the_decorator_binds_no_inner_type', () => {
    const flat: IScoringPolicy<LinesState<SquareCoord>> = { score: () => Score.of(5) };
    const after = linesState(squareTopology, 1, {
      tray: [],
      linesCleared: LineCount.of(2),
      streak: Streak.of(1),
    }).snapshot();

    // 5 from the inner policy, plus 10 × 2 lines × (2 + 1 - 2) for the combo.
    expect(new ComboMultiplierDecorator<SquareCoord>(flat).score(after, after)).toEqual(
      Score.of(25),
    );
  });

  it('should_add_ten_points_for_the_line_when_the_first_clearing_placement_clears_one_line', () => {
    const { engine } = linesGame(
      linesState(squareTopology, 3, { filled: [square(1, 0), square(2, 0)], tray: [one, one] }),
      decorated(),
    );

    playMove(engine, new PlacePiece(TrayPosition.of(0), origin));

    const state = engine.snapshot();
    expect([state.lastCombo(), state.currentStreak()]).toEqual([LineCount.of(1), Streak.of(1)]);
    // 1 cell + 10 × 1 line × (1 + 1 - 1).
    expect(state.scoreSoFar()).toEqual(Score.of(11));
  });

  it('should_multiply_the_line_bonus_by_the_combo_when_one_placement_clears_two_lines', () => {
    const state = comboPlacement(decorated());

    expect([state.lastCombo(), state.currentStreak()]).toEqual([LineCount.of(2), Streak.of(1)]);
    // 1 cell + 10 × 2 lines × (2 + 1 - 1).
    expect(state.scoreSoFar()).toEqual(Score.of(41));
  });

  it('should_multiply_the_line_bonus_by_lines_plus_streak_minus_one_when_clearing_placements_follow_in_a_row', () => {
    // 11, then 1 + 10 × 1 × (1 + 2 - 1) = 21, then 1 cell with no line.
    expect(twoClearingPlacements(decorated())).toEqual([11, 32, 33].map(Score.of));
  });

  it('should_multiply_the_line_bonus_by_lines_plus_streak_minus_one_when_a_combo_follows_a_clearing_placement', () => {
    // Only a combo inside a streak tells `lines + streak - 1` (3) from `lines × streak` (4).
    const { first, state } = comboInAStreak(decorated());

    expect([state.lastCombo(), state.currentStreak(), state.lastPlacedCells()]).toEqual([
      LineCount.of(2),
      Streak.of(2),
      CellCount.of(2),
    ]);
    // 11, then 2 cells + 10 × 2 lines × (2 + 2 - 1) = 62.
    expect([first, state.scoreSoFar()]).toEqual([Score.of(11), Score.of(73)]);
    // The base scoring gives 2 cells + 10 × 2 lines = 22 for the same placement.
    expect(comboInAStreak(new LinesScoring<SquareCoord>()).state.scoreSoFar()).toEqual(
      Score.of(33),
    );
  });

  it('should_give_no_multiplier_when_the_base_lines_scoring_plays_alone', () => {
    const base = new LinesScoring<SquareCoord>();

    expect(comboPlacement(base).scoreSoFar()).toEqual(Score.of(21));
    expect(twoClearingPlacements(base)).toEqual([11, 22, 23].map(Score.of));
  });

  it('should_wrap_the_base_scoring_as_a_scoring_policy_when_the_decorator_is_made', () => {
    const base = new LinesScoring<SquareCoord>();
    const scoring: IScoringPolicy<LinesState<SquareCoord>> = new ComboMultiplierDecorator(base);

    expect(scoring).toBeInstanceOf(ComboMultiplierDecorator);
    expect(
      comboPlacement(scoring).scoreSoFar().isHigherThan(comboPlacement(base).scoreSoFar()),
    ).toBe(true);
  });

  // The class views draw `ComboMultiplierDecorator extends ScoringDecorator` (issue 146).
  it('should_be_a_scoring_decorator_when_the_lines_factory_creates_the_scoring', () => {
    expect(linesFactory().createScoring()).toBeInstanceOf(ScoringDecorator);
  });
});
