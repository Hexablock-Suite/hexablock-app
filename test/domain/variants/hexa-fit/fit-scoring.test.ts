/** @jest-environment node */
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
import { fitStars } from '../../../../src/domain/variants/hexa-fit/fit-stars';
import { FitState } from '../../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { RecordingPublisher } from '../../../support/engine/fake-game';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';

// The Fit scoring of issue #98. It codes against the proposal of issue #59,
// «Propuesta, pendiente del equipo»: no points per turn, and a star needs both of its
// thresholds (moves and time). Whether undo and remove count as moves is issue #60.

const A = PieceId.of('a');
const B = PieceId.of('b');
const NO_TURN = Turns.of(0);

// A 2 × 2 square figure and two horizontal dominoes: they cover it exactly.
function dominoLevel(): FitState<SquareCoord> {
  const domino = [square(0, 0), square(1, 0)];
  const piece = (id: PieceId) => new Piece(new ShapeGroup(domino.map((c) => new CellNode(c))), id);
  return FitState.start(
    new Board<PieceId, SquareCoord, string>(
      squareTopology.region(RegionSize.of(2)),
      squareTopology,
    ),
    new FixedListPieceSource([piece(A), piece(B)]),
  );
}

// One star: at most 10 moves and at most 60 seconds.
const ONE_STAR = [{ maxMoves: 10, maxElapsedMs: 60_000 }];

describe('FitScoring', () => {
  it('should_score_no_points_when_the_turns_win_the_level', () => {
    const engine = new GameEngine<
      PieceId,
      SquareCoord,
      FitMove<SquareCoord>,
      FitState<SquareCoord>
    >(
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
    expect(engine.snapshot().score).toBe(0);
  });
});

describe('fitStars', () => {
  it('should_give_the_star_when_the_moves_and_the_time_meet_both_thresholds', () => {
    expect(fitStars({ moves: 10, elapsedMs: 60_000 }, ONE_STAR)).toBe(1);
  });

  it('should_give_no_star_when_only_the_moves_meet_the_threshold', () => {
    expect(fitStars({ moves: 10, elapsedMs: 60_001 }, ONE_STAR)).toBe(0);
  });

  it('should_give_no_star_when_only_the_time_meets_the_threshold', () => {
    expect(fitStars({ moves: 11, elapsedMs: 60_000 }, ONE_STAR)).toBe(0);
  });

  it('should_give_no_star_when_neither_threshold_is_met', () => {
    expect(fitStars({ moves: 11, elapsedMs: 60_001 }, ONE_STAR)).toBe(0);
  });

  it('should_count_each_star_whose_two_thresholds_are_met_when_the_level_has_three_stars', () => {
    const threeStars = [
      { maxMoves: 20, maxElapsedMs: 120_000 },
      { maxMoves: 12, maxElapsedMs: 90_000 },
      { maxMoves: 8, maxElapsedMs: 30_000 },
    ];

    expect(fitStars({ moves: 10, elapsedMs: 60_000 }, threeStars)).toBe(2);
  });
});
