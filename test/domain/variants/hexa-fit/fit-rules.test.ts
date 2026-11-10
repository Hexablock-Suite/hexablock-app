/** @jest-environment node */
import { Moves } from '../../../../src/domain/engine/moves';
import { Score } from '../../../../src/domain/engine/score';
import { Board } from '../../../../src/domain/engine/board';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { GameOver } from '../../../../src/domain/engine/game-events';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import { PlayingPhase, VictoryPhase } from '../../../../src/domain/engine/game-phase';
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
import { Placement } from '../../../../src/domain/variants/hexa-fit/placement';
import { FitState, type FitSnapshot } from '../../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { RecordingPublisher } from '../../../support/engine/fake-game';
import { fitStateOf } from '../../../support/variants/hexa-fit/fit-game';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  triangle,
  triangleTopology,
  type TriangleCoord,
} from '../../../support/engine/triangle-topology';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// The Fit rules suite (APP-NFR-12: one rules suite per variant).
// The square double keeps the coordinates easy to read. The triangle double has
// six rotation steps of 60°, like the hexagonal topology (A5, D4).

const A = PieceId.of('a');
const B = PieceId.of('b');
const NO_TURN = Turns.of(0);

// These tests give no points. The Fit scoring, the accepted rule of issue #59 (D22),
// has its own suite.
const noPoints: IScoringPolicy<FitState<SquareCoord>> = { score: () => Score.of(0) };

function piece<TCoord>(id: PieceId, cells: TCoord[]): Piece<PieceId, TCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), id);
}

function figure<TCoord>(
  topology: GridTopology<TCoord, string, string>,
  shape: BoardShape<TCoord>,
): Board<PieceId, TCoord, string> {
  return new Board<PieceId, TCoord, string>(BOARD_ID, shape, topology);
}

// The two horizontal dominoes of `dominoLevel()`.
function dominoPieces(): FixedListPieceSource<Piece<PieceId, SquareCoord>> {
  const domino = [square(0, 0), square(1, 0)];
  return new FixedListPieceSource([piece(A, domino), piece(B, domino)]);
}

// A 2 × 2 square figure and two horizontal dominoes: they cover it exactly.
function dominoLevel(): FitState<SquareCoord> {
  const shape = squareTopology.region(RegionSize.of(2));
  return FitState.start(STATE_ID, MATCH_ID, figure(squareTopology, shape), dominoPieces());
}

// Plays one turn of the rules on `state` and gives back that state.
// The rules change the state in place, and a `Resolution` holds no state.
function played<TCoord>(
  rules: FitRules<TCoord>,
  state: FitState<TCoord>,
  move: FitMove<TCoord>,
): FitState<TCoord> {
  rules.playTurn(state, move);
  return state;
}

// The photo of a live state, or the photo itself. Only a photo shows the board.
function photoOf<TCoord>(state: FitState<TCoord> | FitSnapshot<TCoord>): FitSnapshot<TCoord> {
  return state instanceof FitState ? state.snapshot() : state;
}

function engineOn(
  initial: FitState<SquareCoord>,
  publisher = new RecordingPublisher(),
  scoring: IScoringPolicy<FitState<SquareCoord>> = noPoints,
) {
  const engine = new GameEngine<PieceId, SquareCoord, FitMove<SquareCoord>, FitState<SquareCoord>>(
    MATCH_ID,
    GameId.of('hexa-fit'),
    new FitRules<SquareCoord>(),
    scoring,
    publisher,
  );
  engine.start(initial);
  return engine;
}

// The filled cells as `col,row=id` text, sorted, so a test compares whole boards.
function cellsOf<TCoord>(state: FitState<TCoord> | FitSnapshot<TCoord>): string[] {
  const { board } = photoOf(state);
  return board
    .cells()
    .map(([c, id]) => `${board.topology.key(c)}=${id.value}`)
    .sort();
}

function trayOf<TCoord>(state: FitState<TCoord> | FitSnapshot<TCoord>): string[] {
  return photoOf(state)
    .view()
    .remaining.map((p) => p.content.value);
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
    const state = played(rules, dominoLevel(), new PlaceFitPiece(A, NO_TURN, square(0, 0)));

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

    const state = dominoLevel();
    const resolution = rules.playTurn(state, new RemoveFitPiece(A));

    expect(resolution.accepted).toBe(false);
    expect(trayOf(state)).toEqual(['a', 'b']);
  });

  it('should_turn_a_placed_piece_by_one_step_of_60_degrees_when_it_is_rotated', () => {
    // The triangle region of size 1 is an up triangle (0,0) and a down triangle (1,0).
    // One step of 60° around their shared vertex maps (0,0) to (1,0).
    const rules = new FitRules<TriangleCoord>();
    const start = FitState.start(
      STATE_ID,
      MATCH_ID,
      figure(triangleTopology, triangleTopology.region(RegionSize.of(1))),
      new FixedListPieceSource([piece(A, [triangle(0, 0)])]),
    );
    const placed = played(rules, start, new PlaceFitPiece(A, NO_TURN, triangle(0, 0)));

    const turned = rules.playTurn(placed, new RotateFitPiece(A, Turns.of(1)));

    expect(turned.accepted).toBe(true);
    expect(cellsOf(placed)).toEqual(['1,0=a']);
    expect(triangleTopology.fullTurn().equals(Turns.of(6))).toBe(true);
    // Five more steps complete the six steps of a full turn.
    const back = rules.playTurn(placed, new RotateFitPiece(A, Turns.of(5)));
    expect(back.accepted).toBe(true);
    expect(cellsOf(placed)).toEqual(['0,0=a']);
  });

  // The board lists its cells in the order of their writes. A removed piece frees its cells,
  // so the piece that comes back is listed after the pieces that stayed.
  it('should_list_a_placed_again_piece_after_the_other_pieces_when_it_was_removed', () => {
    const rules = new FitRules<SquareCoord>();
    const both = [
      new PlaceFitPiece(A, NO_TURN, square(0, 0)),
      new PlaceFitPiece(B, NO_TURN, square(0, 1)),
    ].reduce((state, move) => played(rules, state, move), dominoLevel());

    const removed = played(rules, both, new RemoveFitPiece(A));
    const again = played(rules, removed, new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    expect(again.snapshot().board.cells()).toEqual([
      [square(0, 1), B],
      [square(1, 1), B],
      [square(0, 0), A],
      [square(1, 0), A],
    ]);
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
    expect(engine.currentPhase()).toBe(VictoryPhase.instance);
    expect(trayOf(engine.snapshot())).toEqual([]);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toBeInstanceOf(GameOver);
    expect((publisher.events[0] as GameOver).outcome).toBe('victory');
  });

  it('should_keep_playing_and_never_lose_when_no_tray_piece_fits', () => {
    // A row of three cells. A single cell in the middle leaves two cells apart,
    // so the domino fits nowhere. Fit has no defeat (REQUIREMENTS.md §1).
    const shape = BoardShape.of([square(0, 0), square(1, 0), square(2, 0)]);
    const pieces = () =>
      new FixedListPieceSource([piece(A, [square(0, 0)]), piece(B, [square(0, 0), square(1, 0)])]);
    const engine = engineOn(
      FitState.start(STATE_ID, MATCH_ID, figure(squareTopology, shape), pieces()),
    );

    const outcome = engine.play(new PlaceFitPiece(A, NO_TURN, square(1, 0)));

    expect(outcome).toBe('playing');
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    const live = fitStateOf(engine.snapshot(), pieces());
    const moves = [...new FitRules<SquareCoord>().validMoves(live)];
    expect(moves.filter((move) => move instanceof PlaceFitPiece)).toEqual([]);
    expect(moves).toContainEqual(new RemoveFitPiece(A));
  });

  it('should_yield_only_valid_moves_and_the_winning_placement_when_the_rules_list_the_valid_moves', () => {
    const rules = new FitRules<SquareCoord>();
    const state = played(rules, dominoLevel(), new PlaceFitPiece(A, NO_TURN, square(0, 0)));

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
        STATE_ID,
        MATCH_ID,
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

// Edge cases of the walkthrough of PR #106 (issue #120).
describe('FitRules edge cases', () => {
  // Tells if the piece lies at `at` with a rotation of `turns` topology steps.
  // `Placement` keeps its fields private, so `equals()` compares the two placements.
  function isPlaced(
    state: FitState<SquareCoord> | FitSnapshot<SquareCoord>,
    id: PieceId,
    turns: number,
    at: SquareCoord,
  ): boolean {
    const expected = Placement.of(Turns.of(turns), at, squareTopology);
    return photoOf(state).placements.some(
      ([placed, placement]) => placed.equals(id) && placement.equals(expected, squareTopology),
    );
  }

  it('should_store_the_rotation_from_zero_to_three_when_a_move_counts_negative_or_huge_steps', () => {
    // `Placement` stores a count that is shorter than the full turn (placement.ts),
    // and a negative count turns the other way (turns.ts).
    const rules = new FitRules<SquareCoord>();

    // Minus one step is three quarter turns: (1,0) goes to (0,-1).
    const state = dominoLevel();
    const placed = rules.playTurn(state, new PlaceFitPiece(A, Turns.of(-1), square(1, 1)));

    expect(placed.accepted).toBe(true);
    expect(isPlaced(state, A, 3, square(1, 1))).toBe(true);
    expect(isPlaced(state, A, 2, square(1, 1))).toBe(false);
    expect(cellsOf(state)).toEqual(['1,0=a', '1,1=a']);

    // 2^53 - 1 is 3 modulo 4. Three steps more than 3 is a half turn.
    const turned = rules.playTurn(state, new RotateFitPiece(A, Turns.of(Number.MAX_SAFE_INTEGER)));

    expect(turned.accepted).toBe(true);
    expect(isPlaced(state, A, 2, square(1, 1))).toBe(true);
    expect(isPlaced(state, A, 3, square(1, 1))).toBe(false);
    expect(cellsOf(state)).toEqual(['0,1=a', '1,1=a']);
  });

  it('should_keep_the_tray_and_leave_the_source_read_when_the_state_starts_from_a_fixed_list', () => {
    // The state reads the source once at start (fit-state.ts), and a fixed list
    // gives its pieces only once (piece-source.ts).
    const domino = [square(0, 0), square(1, 0)];
    const source = new FixedListPieceSource([piece(A, domino), piece(B, domino)]);

    const state = FitState.start(
      STATE_ID,
      MATCH_ID,
      figure(squareTopology, squareTopology.region(RegionSize.of(2))),
      source,
    );

    expect(source.hasNext()).toBe(false);
    expect([...source]).toEqual([]);
    expect(trayOf(state)).toEqual(['a', 'b']);
    expect(trayOf(state.clone())).toEqual(['a', 'b']);
  });

  it('should_keep_playing_with_an_empty_tray_and_no_valid_move_when_the_level_has_no_piece', () => {
    // The game is won only when the pieces cover the figure, and Fit has no defeat (fit-rules.ts).
    // A level without pieces never covers its figure.
    const rules = new FitRules<SquareCoord>();
    const empty = FitState.start(
      STATE_ID,
      MATCH_ID,
      figure(squareTopology, squareTopology.region(RegionSize.of(2))),
      new FixedListPieceSource<Piece<PieceId, SquareCoord>>([]),
    );
    const engine = engineOn(empty);

    const outcome = engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    expect(trayOf(empty)).toEqual([]);
    expect(rules.evaluate(empty)).toBe('playing');
    expect([...rules.validMoves(empty)]).toEqual([]);
    expect(outcome).toBe('playing');
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(cellsOf(engine.snapshot())).toEqual([]);
  });

  it('should_keep_the_filled_figure_cells_and_reject_a_piece_on_them_when_the_figure_starts_with_content', () => {
    // A piece fits only on free cells of the figure (fit-rules.ts). The state copies the figure.
    const board = figure(squareTopology, squareTopology.region(RegionSize.of(2)));
    board.occupy(square(0, 0), PieceId.of('x'));
    const domino = [square(0, 0), square(1, 0)];
    const start = FitState.start(
      STATE_ID,
      MATCH_ID,
      board,
      new FixedListPieceSource([piece(A, domino), piece(B, domino)]),
    );
    const engine = engineOn(start);

    const overlap = engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));
    const free = engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 1)));

    expect(cellsOf(start)).toEqual(['0,0=x']);
    expect(overlap).toBe('playing');
    expect(free).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual(['0,0=x', '0,1=a', '1,1=a']);
    expect(trayOf(engine.snapshot())).toEqual(['b']);
  });

  it('should_throw_a_range_error_and_keep_the_game_when_a_move_of_unknown_kind_arrives_through_a_cast', () => {
    // A value outside the `FitMove` union reaches the rules only through a cast (fit-rules.ts).
    const rules = new FitRules<SquareCoord>();
    const jump = { kind: 'jump', pieceId: A } as unknown as FitMove<SquareCoord>;
    const engine = engineOn(dominoLevel());

    expect(() => rules.isValid(dominoLevel(), jump)).toThrow(RangeError);
    expect(() => rules.isValid(dominoLevel(), jump)).toThrow('Unknown Fit move: jump.');
    expect(() => rules.apply(dominoLevel(), jump)).toThrow(RangeError);
    expect(() => rules.apply(dominoLevel(), jump)).toThrow('Unknown Fit move: jump.');
    expect(() => engine.play(jump)).toThrow(RangeError);
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(cellsOf(engine.snapshot())).toEqual([]);
    expect(trayOf(engine.snapshot())).toEqual(['a', 'b']);
  });

  it('should_give_the_same_moves_in_the_same_order_when_the_valid_moves_are_read_again', () => {
    // Remove and rotate moves of the placed pieces come first, then the place moves (fit-rules.ts).
    // Each call gives a new lazy sequence, so a partial read does not change the next call.
    const rules = new FitRules<SquareCoord>();
    const state = played(rules, dominoLevel(), new PlaceFitPiece(A, NO_TURN, square(0, 0)));
    const expected = [
      new RemoveFitPiece(A),
      new RotateFitPiece(A, Turns.of(1)),
      new PlaceFitPiece(B, NO_TURN, square(0, 1)),
      new PlaceFitPiece(B, Turns.of(2), square(1, 1)),
    ];

    const partial = rules.validMoves(state)[Symbol.iterator]().next();
    const first = [...rules.validMoves(state)];
    const second = [...rules.validMoves(state)];

    expect(partial.value).toEqual(expected[0]);
    expect(first).toEqual(expected);
    expect(second).toEqual(expected);
    expect(cellsOf(state)).toEqual(['0,0=a', '1,0=a']);
  });

  it('should_throw_and_keep_the_game_when_the_topology_throws_during_a_move', () => {
    // An exception leaves the board, the score and the phase (game-engine.ts).
    const failing: GridTopology<SquareCoord, string, string> = {
      ...squareTopology,
      rotate: (c, turns) => {
        if (turns.equals(Turns.of(2))) throw new Error('The topology failed.');
        return squareTopology.rotate(c, turns);
      },
    };
    const domino = [square(0, 0), square(1, 0)];
    const engine = engineOn(
      FitState.start(
        STATE_ID,
        MATCH_ID,
        figure(failing, failing.region(RegionSize.of(2))),
        new FixedListPieceSource([piece(A, domino), piece(B, domino)]),
      ),
    );

    expect(() => engine.play(new PlaceFitPiece(A, Turns.of(2), square(1, 0)))).toThrow(
      'The topology failed.',
    );

    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(cellsOf(engine.snapshot())).toEqual([]);
    expect(trayOf(engine.snapshot())).toEqual(['a', 'b']);
    expect(engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)))).toBe('playing');
    expect(cellsOf(engine.snapshot())).toEqual(['0,0=a', '1,0=a']);
  });

  it('should_reject_the_rotation_and_keep_the_board_when_the_topology_turns_a_cell_outside_the_figure', () => {
    // Every cell of a placed piece lies inside the figure (fit-rules.ts, `fits()`).
    const outward: GridTopology<SquareCoord, string, string> = {
      ...squareTopology,
      rotate: (c, turns) =>
        turns.equals(Turns.of(1)) ? square(9, 9) : squareTopology.rotate(c, turns),
    };
    const domino = [square(0, 0), square(1, 0)];
    const engine = engineOn(
      FitState.start(
        STATE_ID,
        MATCH_ID,
        figure(outward, outward.region(RegionSize.of(2))),
        new FixedListPieceSource([piece(A, domino), piece(B, domino)]),
      ),
    );
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));

    const outcome = engine.play(new RotateFitPiece(A, Turns.of(1)));

    expect(outcome).toBe('playing');
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(cellsOf(engine.snapshot())).toEqual(['0,0=a', '1,0=a']);
    expect(isPlaced(engine.snapshot(), A, 0, square(0, 0))).toBe(true);
  });
});

// The move count of issue #60: every accepted place, rotate and remove counts one move.
// The state holds the count, so the clone that undo keeps holds it too (classes.md decision 34).
describe('FitRules move count', () => {
  it('should_add_one_to_the_move_count_when_a_place_a_rotate_or_a_remove_is_accepted', () => {
    const engine = engineOn(dominoLevel());
    const counts = [engine.snapshot().moves];

    for (const move of [
      new PlaceFitPiece(A, NO_TURN, square(0, 0)),
      new RotateFitPiece(A, Turns.of(1)),
      new RemoveFitPiece(A),
    ]) {
      expect(engine.tryPlay(move).accepted).toBe(true);
      counts.push(engine.snapshot().moves);
    }

    expect(counts).toEqual([0, 1, 2, 3].map((count) => Moves.of(count)));
  });

  it('should_keep_the_move_count_when_a_move_is_rejected', () => {
    const engine = engineOn(dominoLevel());
    engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 1)));

    // B overlaps A, a quarter turn puts A below the figure, and B is not on the figure.
    const reports = [
      engine.tryPlay(new PlaceFitPiece(B, NO_TURN, square(0, 1))),
      engine.tryPlay(new RotateFitPiece(A, Turns.of(1))),
      engine.tryPlay(new RemoveFitPiece(B)),
    ];

    expect(reports.map((r) => r.accepted)).toEqual([false, false, false]);
    expect(engine.snapshot().moves).toEqual(Moves.of(1));
    expect(cellsOf(engine.snapshot())).toEqual(['0,1=a', '1,1=a']);
  });

  it('should_keep_the_move_count_in_the_clone_when_the_state_is_cloned_for_undo', () => {
    // The engine has no undo history yet (Sprint 3). Undo keeps a clone of the state before
    // the move (decision 34), so the clone must hold the count of that state.
    const rules = new FitRules<SquareCoord>();
    const placed = played(rules, dominoLevel(), new PlaceFitPiece(A, NO_TURN, square(0, 0)));
    const before = placed.clone();

    // A move changes its state in place, so the test reads the clone before it replays the clone.
    const removed = played(rules, placed, new RemoveFitPiece(A));
    const kept = [before.snapshot().moves, cellsOf(before)];
    const replayed = played(rules, before, new RemoveFitPiece(A));

    expect(removed.snapshot().moves).toEqual(Moves.of(2));
    expect(kept).toEqual([Moves.of(1), ['0,0=a', '1,0=a']]);
    expect(replayed.snapshot().moves).toEqual(Moves.of(2));
  });
});

// R7: the Fit state is an entity, so it keeps its object. A move changes it in place.
describe('FitRules in place', () => {
  it('should_change_the_same_state_object_when_a_place_a_rotate_or_a_remove_is_applied', () => {
    const rules = new FitRules<SquareCoord>();
    const state = dominoLevel();
    const board = state.snapshot().board;
    const seen = [];

    for (const move of [
      new PlaceFitPiece(A, NO_TURN, square(0, 0)),
      new RotateFitPiece(A, Turns.of(1)),
      new RemoveFitPiece(A),
    ]) {
      const result = rules.apply(state, move);
      seen.push({ same: result === state, cells: cellsOf(state), moves: state.snapshot().moves });
    }

    expect(seen).toEqual([
      { same: true, cells: ['0,0=a', '1,0=a'], moves: Moves.of(1) },
      { same: true, cells: ['0,0=a', '0,1=a'], moves: Moves.of(2) },
      { same: true, cells: [], moves: Moves.of(3) },
    ]);
    // The board keeps its id: the same board changes in place.
    expect(state.snapshot().board.equals(board)).toBe(true);
  });

  // The engine plays a turn on a copy of its state. So a turn that throws after the move
  // changed the copy leaves the state of the game as it was (classes.md decision 34).
  it('should_keep_the_snapshot_when_the_turn_throws_after_the_move_changed_the_state', () => {
    const failing: IScoringPolicy<FitState<SquareCoord>> = {
      score: () => {
        throw new Error('The scoring fails.');
      },
    };
    const engine = engineOn(dominoLevel(), new RecordingPublisher(), failing);
    const playing = engineOn(dominoLevel());
    playing.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)));
    const placed = engineOn(
      fitStateOf(playing.snapshot(), dominoPieces()),
      new RecordingPublisher(),
      failing,
    );
    const facts = (state: FitSnapshot<SquareCoord>) => ({
      cells: cellsOf(state),
      tray: trayOf(state),
      moves: state.moves,
      score: state.score,
    });
    const before = [facts(engine.snapshot()), facts(placed.snapshot())];

    expect(() => engine.play(new PlaceFitPiece(A, NO_TURN, square(0, 0)))).toThrow(
      'The scoring fails.',
    );
    expect(() => placed.play(new RotateFitPiece(A, Turns.of(1)))).toThrow('The scoring fails.');
    expect(() => placed.play(new RemoveFitPiece(A))).toThrow('The scoring fails.');
    expect([facts(engine.snapshot()), facts(placed.snapshot())]).toEqual(before);
  });
});
