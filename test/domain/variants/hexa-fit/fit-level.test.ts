/** @jest-environment node */
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { ElapsedTime } from '../../../../src/domain/shared/elapsed-time';
import { TopologyId } from '../../../../src/domain/shared/topology-id';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import { Moves } from '../../../../src/domain/shared/moves';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { Stars } from '../../../../src/domain/progress/stars';
import { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { FitStarThreshold } from '../../../../src/domain/variants/hexa-fit/fit-stars';
import type { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { A, B } from '../../../support/variants/hexa-fit/fit-game';
import { delivered } from '../../../support/engine/value-receiver';

// A Fit level is a value object that guards its own invariant (issue 208, classes.md decision 46).

type FitPiece = Piece<PieceId, SquareCoord>;

function domino(id: PieceId, col = 0): FitPiece {
  return new Piece(
    new ShapeGroup([new CellNode(square(col, 0)), new CellNode(square(col + 1, 0))]),
    id,
  );
}

function row(length: number): BoardShape<SquareCoord> {
  return BoardShape.of(Array.from({ length }, (_, col) => square(col, 0)));
}

function ids(level: FitLevel<SquareCoord>): string[] {
  return level.trayPieces().map((piece) => delivered(piece.occupant()));
}

// A star threshold of `maxMoves` moves and `maxElapsedMs` milliseconds.
function star(maxMoves: number, maxElapsedMs: number): FitStarThreshold {
  return FitStarThreshold.of({
    maxMoves: Moves.of(maxMoves),
    maxElapsedMs: ElapsedTime.ofMs(maxElapsedMs),
  });
}

// A level with no star threshold, for the tests that do not count stars.
const NO_STARS: readonly FitStarThreshold[] = [];

// The stars that `level` gives to a play of `moves` moves and `elapsedMs` milliseconds.
function starsOf(level: FitLevel<SquareCoord>, moves: number, elapsedMs: number): Stars {
  return level.starsFor(Moves.of(moves), ElapsedTime.ofMs(elapsedMs));
}

describe('FitLevel', () => {
  // Issue #237: the error carries the id as its `cause`, and the edge delivers its text.
  it('should_throw_a_range_error_that_carries_the_id_when_the_level_gets_two_pieces_with_one_id', () => {
    const create = () =>
      FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B), domino(A)], NO_STARS);

    expect(create).toThrow(new RangeError('The level has two pieces with one id.', { cause: A }));
  });

  it('should_throw_a_range_error_when_the_level_pieces_hold_undefined', () => {
    // Only a cast or a sparse list puts `undefined` in the pieces, as a broken level file would.
    const pieces = [domino(A), undefined] as unknown as FitPiece[];

    const create = () => FitLevel.of(TopologyId.square, row(2), pieces, NO_STARS);

    expect(create).toThrow(new RangeError('A piece list cannot hold undefined.'));
  });

  it('should_keep_its_pieces_when_the_array_that_built_the_level_changes', () => {
    const pieces = [domino(A)];
    const level = FitLevel.of(TopologyId.square, row(4), pieces, NO_STARS);

    pieces.push(domino(A));
    pieces[0] = domino(B);

    expect(ids(level)).toEqual(['a']);
  });

  it('should_refuse_a_write_when_a_caller_changes_the_level_or_its_piece_list', () => {
    const level = FitLevel.of(TopologyId.square, row(4), [domino(A)], NO_STARS);

    expect(Object.isFrozen(level)).toBe(true);
    expect(Reflect.set(level, 'pieces', [])).toBe(false);
    expect(Reflect.set(level.trayPieces(), 0, domino(B))).toBe(false);
    expect(ids(level)).toEqual(['a']);
  });

  it('should_be_equal_when_two_levels_hold_the_same_data', () => {
    const one = FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)], NO_STARS);
    const other = FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)], NO_STARS);

    expect(one).not.toBe(other);
    expect(one.equals(other, squareTopology)).toBe(true);
    expect(other.equals(one, squareTopology)).toBe(true);
  });

  it('should_not_be_equal_when_two_levels_differ_in_one_part', () => {
    const level = FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)], NO_STARS);
    const others = [
      FitLevel.of(TopologyId.hex, row(4), [domino(A), domino(B, 2)], NO_STARS),
      FitLevel.of(TopologyId.square, row(5), [domino(A), domino(B, 2)], NO_STARS),
      FitLevel.of(TopologyId.square, row(4), [domino(A)], NO_STARS),
      FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B)], NO_STARS),
      // The tray keeps the order of the level, so the order of the pieces counts.
      FitLevel.of(TopologyId.square, row(4), [domino(B, 2), domino(A)], NO_STARS),
      FitLevel.of(TopologyId.square, row(4), [domino(A), domino(B, 2)], [star(4, 1000)]),
    ];

    for (const other of others) {
      expect(level.equals(other, squareTopology)).toBe(false);
      expect(other.equals(level, squareTopology)).toBe(false);
    }
  });

  // Issue #234: a geometry keeps its family private, so the level asks the geometry.
  it('should_tell_whether_it_runs_on_a_geometry_when_a_factory_asks_the_level', () => {
    const level = FitLevel.of(TopologyId.square, row(2), [domino(A)], NO_STARS);
    const hexGeometry = new HexGeometry();

    expect(level.runsOn(new SquareGeometry())).toBe(true);
    expect(level.runsOn(hexGeometry)).toBe(false);
    // Issue #237: the error carries the topology of the level and the geometry as its `cause`.
    const error = level.wrongFamily(hexGeometry);
    expect(error).toEqual(
      new RangeError('A Fit level cannot start on the geometry of another topology.'),
    );
    expect(error.cause).toEqual({ topology: TopologyId.square, geometry: hexGeometry });
  });

  it('should_give_its_figure_as_a_tree_of_cells_when_a_factory_asks_the_level', () => {
    const level = FitLevel.of(TopologyId.square, row(3), [], NO_STARS);

    const cells = level.figureTree().cells();

    expect(cells.map((c) => delivered(squareTopology.key(c)))).toEqual(['0,0', '1,0', '2,0']);
  });

  // Issue #166: the level holds the thresholds of its stars, and the stars are cumulative.
  it('should_count_the_leading_thresholds_that_the_play_meets_when_the_level_counts_its_stars', () => {
    const level = FitLevel.of(
      TopologyId.square,
      row(2),
      [domino(A)],
      [star(12, 120000), star(8, 60000), star(4, 30000)],
    );

    expect(starsOf(level, 4, 30000)).toEqual(Stars.of(3));
    expect(starsOf(level, 8, 60000)).toEqual(Stars.of(2));
    expect(starsOf(level, 10, 100000)).toEqual(Stars.of(1));
    // The play meets the moves of the third star, but not the time of the first one.
    expect(starsOf(level, 4, 120001)).toEqual(Stars.of(0));
    expect(starsOf(level, 13, 1000)).toEqual(Stars.of(0));
  });

  it('should_keep_its_thresholds_when_the_array_that_built_the_level_changes', () => {
    const thresholds = [star(4, 30000)];
    const level = FitLevel.of(TopologyId.square, row(2), [domino(A)], thresholds);

    thresholds.push(star(2, 1000));
    thresholds[0] = star(1, 1);

    expect(starsOf(level, 4, 30000)).toEqual(Stars.of(1));
  });

  // A Fit level always has a timer, so it takes the time of each play (issue #424).
  // `GameResult` refuses a result with no time before it asks the level.
  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_counts_the_stars_of_a_play_with_no_time', () => {
    const level = FitLevel.of(TopologyId.square, row(2), [domino(A)], [star(4, 30000)]);
    const counts = [
      // @ts-expect-error A Fit level needs the time of the play.
      () => level.starsFor(Moves.of(4), undefined),
      // @ts-expect-error A Fit level needs the time of the play.
      () => level.starsFor(Moves.of(4)),
    ];

    expect(counts).toHaveLength(2);
    expect(starsOf(level, 4, 30000)).toEqual(Stars.of(1));
  });
});
