/** @jest-environment node */
import { Board } from '../../../../src/domain/engine/board';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { GameOver } from '../../../../src/domain/engine/game-events';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import type { GridTopology } from '../../../../src/domain/engine/grid-topology';
import { Piece } from '../../../../src/domain/engine/piece';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { Turns } from '../../../../src/domain/engine/turns';
import {
  PlaceFitPiece,
  RemoveFitPiece,
  RotateFitPiece,
  type FitMove,
} from '../../../../src/domain/variants/hexa-fit/fit-move';
import { FitRules } from '../../../../src/domain/variants/hexa-fit/fit-rules';
import { FitState } from '../../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { RecordingPublisher } from '../../../support/engine/fake-game';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  triangle,
  triangleTopology,
  type TriangleCoord,
} from '../../../support/engine/triangle-topology';

// The Fit rules suite (APP-NFR-12: one rules suite per variant).
// The square double keeps the coordinates easy to read. The triangle double has
// six rotation steps of 60°, like the hexagonal topology (A5, D4).

const A = PieceId.of('a');
const B = PieceId.of('b');
const NO_TURN = Turns.of(0);

// Fit scoring is open (decision #59), so these tests give no points.
const noPoints: IScoringPolicy<FitState<SquareCoord>> = { score: () => 0 };

function piece<TCoord>(id: PieceId, cells: TCoord[]): Piece<PieceId, TCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), id);
}

function figure<TCoord>(
  topology: GridTopology<TCoord, string, string>,
  shape: BoardShape<TCoord>,
): Board<PieceId, TCoord, string> {
  return new Board<PieceId, TCoord, string>(shape, topology);
}

// A 2 × 2 square figure and two horizontal dominoes: they cover it exactly.
function dominoLevel(): FitState<SquareCoord> {
  const shape = squareTopology.region(RegionSize.of(2));
  const domino = [square(0, 0), square(1, 0)];
  return FitState.start(
    figure(squareTopology, shape),
    new FixedListPieceSource([piece(A, domino), piece(B, domino)]),
  );
}

function engineOn(initial: FitState<SquareCoord>, publisher = new RecordingPublisher()) {
  const engine = new GameEngine<PieceId, SquareCoord, FitMove<SquareCoord>, FitState<SquareCoord>>(
    GameId.of('hexa-fit'),
    new FitRules<SquareCoord>(),
    noPoints,
    publisher,
  );
  engine.start(initial);
  return engine;
}

// The filled cells as `col,row=id` text, sorted, so a test compares whole boards.
function cellsOf<TCoord>(state: FitState<TCoord>): string[] {
  return state.board
    .cells()
    .map(([c, id]) => `${state.board.topology.key(c)}=${id.value}`)
    .sort();
}

function trayOf<TCoord>(state: FitState<TCoord>): string[] {
  return state.remaining().map((p) => p.content.value);
}

describe('FitRules', () => {
  it('should_put_the_piece_on_its_cells_and_take_it_from_the_tray_when_it_lies_on_free_figure_cells', () => {
    const engine = engineOn(dominoLevel());

    const outcome = engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    expect(outcome).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual(['0,0=a', '1,0=a']);
    expect(trayOf(engine.snapshot())).toEqual(['b']);
  });

  it('should_reject_the_piece_and_keep_the_board_when_it_overlaps_another_piece', () => {
    const engine = engineOn(dominoLevel());
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    // Both cells lie inside the figure, and both hold the piece a.
    const outcome = engine.play(new PlaceFitPiece(B, NO_TURN, square(0, 0)));

    expect(outcome).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual(['0,0=a', '1,0=a']);
    expect(trayOf(engine.snapshot())).toEqual(['b']);
  });

  it('should_reject_the_piece_and_keep_the_board_when_it_leaves_the_figure', () => {
    const engine = engineOn(dominoLevel());

    const outcome = engine.play(new PlaceFitPiece(A, NO_TURN, square(1, 1)));

    expect(outcome).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual([]);
    expect(trayOf(engine.snapshot())).toEqual(['a', 'b']);
  });

  it('should_reject_a_place_when_the_piece_is_already_on_the_figure_or_unknown', () => {
    const rules = new FitRules<SquareCoord>();
    const state = rules.playTurn(dominoLevel(), new PlaceFitPiece(A, NO_TURN, square(0, 0))).state;

    expect(rules.isValid(state, new PlaceFitPiece(A, NO_TURN, square(0, 1)))).toBe(false);
    expect(rules.isValid(state, new PlaceFitPiece(PieceId.of('z'), NO_TURN, square(0, 1)))).toBe(
      false,
    );
  });

  it('should_place_the_piece_turned_by_its_rotation_when_the_place_move_has_one', () => {
    const engine = engineOn(dominoLevel());

    // A quarter turn maps the cells (0,0) and (1,0) to (0,0) and (0,1).
    engine.play(new PlaceFitPiece(A, Turns.of(1), square(1, 0)));

    expect(cellsOf(engine.snapshot())).toEqual(['1,0=a', '1,1=a']);
  });

  it('should_free_the_cells_and_return_the_piece_to_the_tray_when_a_placed_piece_is_removed', () => {
    const engine = engineOn(dominoLevel());
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    const outcome = engine.play(new RemoveFitPiece(A));

    expect(outcome).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual([]);
    expect(trayOf(engine.snapshot())).toEqual(['a', 'b']);
  });

  it('should_reject_a_remove_when_the_piece_is_not_on_the_figure', () => {
    const rules = new FitRules<SquareCoord>();

    const resolution = rules.playTurn(dominoLevel(), new RemoveFitPiece(A));

    expect(resolution.accepted).toBe(false);
    expect(trayOf(resolution.state)).toEqual(['a', 'b']);
  });

  it('should_turn_a_placed_piece_by_one_step_of_60_degrees_when_it_is_rotated', () => {
    // The triangle region of size 1 is an up triangle (0,0) and a down triangle (1,0).
    // One step of 60° around their shared vertex maps (0,0) to (1,0).
    const rules = new FitRules<TriangleCoord>();
    const start = FitState.start(
      figure(triangleTopology, triangleTopology.region(RegionSize.of(1))),
      new FixedListPieceSource([piece(A, [triangle(0, 0)])]),
    );
    const placed = rules.playTurn(start, new PlaceFitPiece(A, NO_TURN, triangle(0, 0))).state;

    const turned = rules.playTurn(placed, new RotateFitPiece(A, Turns.of(1)));

    expect(turned.accepted).toBe(true);
    expect(cellsOf(turned.state)).toEqual(['1,0=a']);
    expect(triangleTopology.rotationSteps).toBe(6);
    // Five more steps complete the six steps of a full turn.
    const back = rules.playTurn(turned.state, new RotateFitPiece(A, Turns.of(5)));
    expect(cellsOf(back.state)).toEqual(['0,0=a']);
  });

  it('should_turn_the_piece_over_its_own_cell_when_the_turned_piece_keeps_that_cell', () => {
    const engine = engineOn(dominoLevel());
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    // A quarter turn keeps the cell (0,0), which the piece a already holds.
    const outcome = engine.play(new RotateFitPiece(A, Turns.of(1)));

    expect(outcome).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual(['0,0=a', '0,1=a']);
  });

  it('should_reject_a_rotation_and_keep_the_board_when_the_turned_piece_leaves_the_figure', () => {
    const engine = engineOn(dominoLevel());
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 1)));

    // A quarter turn would put the second cell on (0,2), below the figure.
    const outcome = engine.play(new RotateFitPiece(A, Turns.of(1)));

    expect(outcome).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual(['0,1=a', '1,1=a']);
  });

  it('should_win_and_publish_game_over_when_the_pieces_cover_the_figure_exactly', () => {
    const publisher = new RecordingPublisher();
    const engine = engineOn(dominoLevel(), publisher);
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    const outcome = engine.play(new PlaceFitPiece(B, NO_TURN, square(0, 1)));

    expect(outcome).toBe('victory');
    expect(engine.phase.name).toBe('victory');
    expect(trayOf(engine.snapshot())).toEqual([]);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toBeInstanceOf(GameOver);
    expect((publisher.events[0] as GameOver).outcome).toBe('victory');
  });

  it('should_keep_playing_and_never_lose_when_no_tray_piece_fits', () => {
    // A row of three cells. A single cell in the middle leaves two cells apart,
    // so the domino fits nowhere. Fit has no defeat (REQUIREMENTS.md §1).
    const shape = BoardShape.of([square(0, 0), square(1, 0), square(2, 0)]);
    const engine = engineOn(
      FitState.start(
        figure(squareTopology, shape),
        new FixedListPieceSource([
          piece(A, [square(0, 0)]),
          piece(B, [square(0, 0), square(1, 0)]),
        ]),
      ),
    );

    const outcome = engine.play(new PlaceFitPiece(A, NO_TURN, square(1, 0)));

    expect(outcome).toBe('playing');
    expect(engine.phase.name).toBe('playing');
    const moves = [...new FitRules<SquareCoord>().validMoves(engine.snapshot())];
    expect(moves.filter((move) => move.kind === 'place')).toEqual([]);
    expect(moves).toContainEqual(new RemoveFitPiece(A));
  });

  it('should_yield_only_valid_moves_and_the_winning_placement_when_the_rules_list_the_valid_moves', () => {
    const rules = new FitRules<SquareCoord>();
    const state = rules.playTurn(dominoLevel(), new PlaceFitPiece(A, NO_TURN, square(0, 0))).state;

    const moves = [...rules.validMoves(state)];

    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) expect(rules.isValid(state, move)).toBe(true);
    expect(moves).toContainEqual(new PlaceFitPiece(B, NO_TURN, square(0, 1)));
    expect(moves).toContainEqual(new RemoveFitPiece(A));
  });

  it('should_throw_a_range_error_when_the_piece_source_repeats_a_piece_id', () => {
    const shape = squareTopology.region(RegionSize.of(2));

    expect(() =>
      FitState.start(
        figure(squareTopology, shape),
        new FixedListPieceSource([piece(A, [square(0, 0)]), piece(A, [square(0, 0)])]),
      ),
    ).toThrow(RangeError);
  });

  it('should_throw_a_range_error_when_a_piece_id_is_empty', () => {
    expect(() => PieceId.of('')).toThrow(RangeError);
    expect(() => PieceId.of('  ')).toThrow(RangeError);
  });
});
