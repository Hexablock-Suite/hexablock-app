/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/engine/score';
import { GameOverPhase, PlayingPhase } from '../../../../src/domain/engine/game-phase';
import type { GridTopology } from '../../../../src/domain/engine/grid-topology';
import { GameOver } from '../../../../src/domain/engine/game-events';
import { SeededPieceSource } from '../../../../src/domain/engine/piece-source';
import { BaseGameRules, type IGameRules } from '../../../../src/domain/engine/rules';
import { Color } from '../../../../src/domain/engine/color';
import { ComboMultiplierDecorator } from '../../../../src/domain/variants/hexa-lines/combo-multiplier-decorator';
import { LinesRules } from '../../../../src/domain/variants/hexa-lines/lines-rules';
import { LinesScoring } from '../../../../src/domain/variants/hexa-lines/lines-scoring';
import {
  LinesState,
  type LinesSnapshot,
} from '../../../../src/domain/variants/hexa-lines/lines-state';
import { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { phaseNameOf } from '../../../support/engine/phase-name';
import {
  square,
  squareTopology,
  SquareAxis,
  type SquareCoord,
  type SquareDirection,
} from '../../../support/engine/square-topology';
import {
  triangle,
  triangleTopology,
  type TriangleCoord,
} from '../../../support/engine/triangle-topology';
import {
  filledKeys,
  linesFactory,
  linesGame,
  linesState,
  piece,
} from '../../../support/variants/hexa-lines/lines-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';
import { firstValidMove } from '../../../support/engine/variant-game';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';

// The rules suite of Hexa Lines (issue 91, APP-NFR-02, APP-NFR-12).
// The combo and the streak follow the proposal on issue 58,
// «Propuesta, pendiente del equipo (cola nocturna, 2026-11-06)».
// The tests play through `GameEngine.play()`, so the engine calls only the rules contract.

const origin = square(0, 0);
const one = piece(origin);

function keys(cells: readonly SquareCoord[]): string[] {
  return cells.map((c) => squareTopology.key(c)).sort();
}

describe('Hexa Lines rules', () => {
  it('should_implement_the_rules_contract_through_the_base_rules_when_a_lines_rules_is_made', () => {
    const rules: IGameRules<
      PlacePiece<SquareCoord>,
      LinesState<SquareCoord>
    > = new LinesRules<SquareCoord>();

    expect(rules).toBeInstanceOf(BaseGameRules);
  });

  it('should_put_the_piece_on_the_board_and_take_it_from_the_tray_when_the_piece_fits', () => {
    const domino = piece(origin, square(1, 0));
    const { engine } = linesGame(linesState(squareTopology, 4, { tray: [domino, one] }));

    const outcome = engine.play(new PlacePiece(0, square(1, 2)));

    const state = engine.snapshot();
    expect(outcome).toBe(Outcome.playing);
    expect(filledKeys(state)).toEqual(keys([square(1, 2), square(2, 2)]));
    expect(state.tray).toEqual([one]);
    expect(state.streak).toBe(0);
    expect(state.linesCleared).toBe(0);
  });

  it('should_draw_a_tray_of_three_pieces_from_the_source_when_the_last_tray_piece_is_placed', () => {
    const [a, b, c, d] = [square(1, 0), square(0, 1), square(1, 1), square(2, 0)].map((x) =>
      piece(origin, x),
    );
    const { engine } = linesGame(
      linesState(squareTopology, 4, { tray: [one], source: [a!, b!, c!, d!] }),
    );

    engine.play(new PlacePiece(0, square(3, 3)));

    const state = engine.snapshot();
    expect(state.tray).toEqual([a, b, c]);
    expect(state.source.take().piece).toBe(d);
  });

  it('should_reject_the_move_and_keep_the_state_when_the_piece_does_not_fit_or_names_no_tray_piece', () => {
    const domino = piece(origin, square(1, 0));
    // An overlap, a cell outside the board, and a tray index past the tray.
    // A tray index that is negative or not whole builds no move (issue #205, moves.test.ts).
    const moves = [
      new PlacePiece(0, square(1, 1)),
      new PlacePiece(0, square(2, 1)),
      new PlacePiece(2, square(0, 0)),
    ];

    for (const move of moves) {
      const { engine } = linesGame(
        linesState(squareTopology, 3, { filled: [square(1, 1)], tray: [domino, one] }),
      );

      const outcome = engine.play(move);

      const state = engine.snapshot();
      expect(outcome).toBe(Outcome.playing);
      expect(engine.currentPhase()).toBe(PlayingPhase.instance);
      expect(filledKeys(state)).toEqual(keys([square(1, 1)]));
      expect(state.tray).toEqual([domino, one]);
    }
  });

  it('should_clear_the_full_line_when_a_placement_fills_a_line_on_each_axis_of_a_square_topology', () => {
    const axes = squareTopology.axes();
    expect(axes).toHaveLength(2);

    for (const axis of axes) {
      const probe = linesState(squareTopology, 3, { tray: [] });
      const line = [...probe.snapshot().board.line(axis, square(1, 1))];
      const last = line[line.length - 1]!;
      const { engine } = linesGame(
        linesState(squareTopology, 3, { filled: line.slice(0, -1), tray: [one, one] }),
      );

      engine.play(new PlacePiece(0, last));

      const state = engine.snapshot();
      expect(line).toHaveLength(3);
      expect(filledKeys(state)).toEqual([]);
      expect(state.linesCleared).toBe(1);
      expect(state.streak).toBe(1);
    }
  });

  it('should_clear_the_full_line_on_each_of_the_three_axes_when_the_topology_is_triangular', () => {
    const topology: GridTopology<TriangleCoord> = triangleTopology;
    const axes = topology.axes();
    expect(axes).toHaveLength(3);

    for (const axis of axes) {
      const probe = linesState(topology, 4, { tray: [] });
      const line = [...probe.snapshot().board.line(axis, triangle(4, 1))];
      const last = line[line.length - 1]!;
      // The piece holds the last cell, and the zero offset leaves it there.
      const { engine } = linesGame(
        linesState(topology, 4, {
          filled: line.slice(0, -1),
          tray: [piece(last), piece(triangle(0, 0))],
        }),
      );

      engine.play(new PlacePiece(0, triangle(0, 0)));

      const state = engine.snapshot();
      expect(line.length).toBeGreaterThanOrEqual(3);
      for (const c of line) expect(state.board.get(c)).toBeUndefined();
      expect(state.linesCleared).toBeGreaterThanOrEqual(1);
    }
  });

  it('should_count_two_lines_and_clear_the_shared_cell_once_when_one_placement_fills_lines_on_two_axes', () => {
    const { engine } = linesGame(
      linesState(squareTopology, 3, {
        filled: [square(1, 0), square(2, 0), square(0, 1), square(0, 2), square(2, 2)],
        tray: [one, one],
      }),
    );

    const outcome = engine.play(new PlacePiece(0, origin));

    const state = engine.snapshot();
    expect(outcome).toBe(Outcome.playing);
    expect(state.linesCleared).toBe(2);
    expect(filledKeys(state)).toEqual(keys([square(2, 2)]));
  });

  it('should_count_the_streak_and_reset_it_when_a_placement_clears_no_line', () => {
    const { engine } = linesGame(
      linesState(squareTopology, 3, {
        filled: [square(1, 0), square(2, 0), square(1, 1), square(2, 1)],
        tray: [one, one, one],
        source: [one, one, one],
      }),
    );

    engine.play(new PlacePiece(0, square(0, 0)));
    const first = engine.snapshot();
    engine.play(new PlacePiece(0, square(0, 1)));
    const second = engine.snapshot();
    engine.play(new PlacePiece(0, square(2, 2)));
    const third = engine.snapshot();

    expect([first.streak, first.linesCleared]).toEqual([1, 1]);
    expect([second.streak, second.linesCleared]).toEqual([2, 1]);
    expect([third.streak, third.linesCleared]).toEqual([0, 0]);
  });

  it('should_leave_the_cleared_cells_empty_and_keep_every_other_cell_in_place_when_a_line_clears', () => {
    const { engine } = linesGame(
      linesState(squareTopology, 3, {
        filled: [square(0, 1), square(1, 1), square(0, 0), square(1, 2)],
        tray: [one, one],
      }),
    );

    engine.play(new PlacePiece(0, square(2, 1)));

    // With gravity, (0, 0) would fall into the cleared row.
    expect(filledKeys(engine.snapshot())).toEqual(keys([square(0, 0), square(1, 2)]));
  });

  it('should_read_the_board_only_up_to_the_first_valid_move_when_a_caller_asks_for_one_move', () => {
    const reads = { count: 0 };
    const counting: GridTopology<SquareCoord, SquareAxis, SquareDirection> = {
      ...squareTopology,
      key: (c) => {
        reads.count += 1;
        return squareTopology.key(c);
      },
    };
    const state = linesState(counting, 5, { tray: [one, piece(origin, square(1, 0))] });
    const rules = new LinesRules<SquareCoord>();

    // The rules read the state through one photo, and the copy of the board in the photo
    // reads each key of the shape once. The walk of the moves reads the keys after it.
    reads.count = 0;
    state.snapshot();
    const photoReads = reads.count;
    reads.count = 0;
    const moves = rules.validMoves(state);
    const first = moves[Symbol.iterator]().next();
    const firstReads = reads.count - photoReads;
    reads.count = 0;
    const all = [...rules.validMoves(state)];
    const allReads = reads.count - photoReads;

    expect(Array.isArray(moves)).toBe(false);
    expect(first.done).toBe(false);
    expect(rules.isValid(state, first.value as PlacePiece<SquareCoord>)).toBe(true);
    expect(all).toHaveLength(25 + 20);
    expect(all.every((move) => rules.isValid(state, move))).toBe(true);
    expect(firstReads).toBeLessThan(allReads / 10);
  });

  it('should_end_the_game_when_no_tray_piece_fits_after_the_placement', () => {
    const long = piece(origin, square(1, 0), square(2, 0), square(3, 0));
    const { engine, publisher } = linesGame(linesState(squareTopology, 3, { tray: [one, long] }));

    const outcome = engine.play(new PlacePiece(0, square(1, 1)));

    expect(outcome).toBe(Outcome.gameOver);
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(publisher.events).toEqual([expect.any(GameOver)]);
  });

  it('should_keep_playing_when_a_tray_piece_still_fits_after_the_placement', () => {
    const { engine, publisher } = linesGame(linesState(squareTopology, 3, { tray: [one, one] }));

    const outcome = engine.play(new PlacePiece(0, square(1, 1)));

    expect(outcome).toBe(Outcome.playing);
    expect(publisher.events).toEqual([]);
  });

  it('should_keep_an_earlier_snapshot_when_a_later_move_changes_the_game', () => {
    const { engine } = linesGame(
      linesState(squareTopology, 3, { tray: [one], source: [one, one, one] }),
    );
    const before = engine.snapshot();

    engine.play(new PlacePiece(0, square(1, 1)));

    expect(filledKeys(before)).toEqual([]);
    expect(before.tray).toEqual([one]);
    expect(before.source.hasNext()).toBe(true);
    expect(engine.snapshot().source.hasNext()).toBe(false);
  });
});

describe('Hexa Lines color', () => {
  it('should_keep_the_name_when_a_color_is_made_from_a_name', () => {
    expect(Color.of('red').equals(Color.of('red'))).toBe(true);
    expect(Color.of('red').equals(Color.of('blue'))).toBe(false);
  });

  it('should_throw_a_range_error_when_the_color_name_is_blank', () => {
    expect(() => Color.of(' ')).toThrow(RangeError);
  });
});

// Edge cases of the walkthrough of PR #107 (issue #120).
describe('Hexa Lines rules edge cases', () => {
  const domino = piece(origin, square(1, 0));

  // Plays the move on a new 3 × 3 game and reports what an observer sees.
  function playOnce(move: PlacePiece<SquareCoord>) {
    const initial = linesState(squareTopology, 3, { filled: [square(1, 1)], tray: [domino, one] });
    const { engine, publisher } = linesGame(initial);

    const outcome = engine.play(move);

    const state = engine.snapshot();
    return {
      valid: new LinesRules<SquareCoord>().isValid(initial, move),
      outcome,
      phase: phaseNameOf(engine.currentPhase()),
      filled: filledKeys(state),
      tray: state.tray,
      events: publisher.events,
    };
  }

  // A rejected move keeps the board, the tray and the phase, and publishes nothing.
  const rejected = {
    valid: false,
    outcome: Outcome.playing,
    phase: 'playing',
    filled: keys([square(1, 1)]),
    tray: [domino, one],
    events: [],
  };

  it('should_build_no_move_for_the_rules_when_the_tray_index_is_not_a_whole_number_of_0_or_more', () => {
    // The tray index names a tray piece. `PlacePiece` checks it (issue #205), so the rules
    // never see such a move, and `isValid()` does not repeat the check.
    for (const index of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      -1,
      0.5,
    ]) {
      expect(() => new PlacePiece(index, square(0, 0))).toThrow(RangeError);
    }
  });

  it('should_reject_the_move_and_keep_the_state_when_the_tray_index_is_past_the_tray', () => {
    // The largest whole number is a tray index, but no tray piece has that index.
    for (const index of [2, 3, Number.MAX_SAFE_INTEGER]) {
      expect(playOnce(new PlacePiece(index, square(0, 0)))).toEqual(rejected);
    }
  });

  it('should_place_the_first_tray_piece_when_the_tray_index_is_negative_zero', () => {
    // The engine reads a negative zero as 0 (classes.md, issue #86: `of()` stores -0 as 0).
    const { engine } = linesGame(linesState(squareTopology, 4, { tray: [domino, one] }));

    const outcome = engine.play(new PlacePiece(-0, square(1, 2)));

    const state = engine.snapshot();
    expect(outcome).toBe(Outcome.playing);
    expect(filledKeys(state)).toEqual(keys([square(1, 2), square(2, 2)]));
    expect(state.tray).toEqual([one]);
  });

  it('should_throw_a_range_error_when_the_color_name_is_empty', () => {
    expect(() => Color.of('')).toThrow(RangeError);
    expect(() => Color.of('')).toThrow('A color needs a name.');
  });

  it('should_end_the_game_with_free_cells_when_a_finite_source_leaves_the_tray_empty', () => {
    // The tray takes the next pieces, or fewer when a finite source runs out (PR #107).
    // The game ends when no tray piece fits (REQUIREMENTS.md §1), and an empty tray has none.
    const { engine, publisher } = linesGame(linesState(squareTopology, 3, { tray: [one] }));

    const outcome = engine.play(new PlacePiece(0, square(1, 1)));

    const state = engine.snapshot();
    expect(outcome).toBe(Outcome.gameOver);
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(state.tray).toEqual([]);
    expect(filledKeys(state)).toEqual(keys([square(1, 1)]));
    expect(publisher.events).toEqual([expect.any(GameOver)]);
  });

  it('should_throw_and_keep_the_game_when_the_source_or_the_topology_throws_during_a_move', () => {
    // The rollback covers the whole state and the phase (classes.md decision 21).
    const base = linesState(squareTopology, 3, { tray: [one] });
    const failingSource = new SeededPieceSource<typeof one>(1, () => {
      throw new Error('The source failed.');
    });
    const failingTopology: GridTopology<SquareCoord, SquareAxis, SquareDirection> = {
      ...squareTopology,
      translate: (c, offset) => {
        if (offset.equals(square(2, 2))) throw new Error('The topology failed.');
        return squareTopology.translate(c, offset);
      },
    };
    const games = [
      {
        game: linesGame(
          new LinesState(
            STATE_ID,
            MATCH_ID,
            base.snapshot().board.clone(),
            base.snapshot().tray,
            failingSource,
          ),
        ),
        error: 'The source failed.',
      },
      {
        game: linesGame(linesState(failingTopology, 3, { tray: [one, one] })),
        error: 'The topology failed.',
      },
    ];

    for (const { game, error } of games) {
      const { engine, publisher } = game;
      const tray = engine.snapshot().tray;

      expect(() => engine.play(new PlacePiece(0, square(2, 2)))).toThrow(error);

      const state = engine.snapshot();
      expect(engine.currentPhase()).toBe(PlayingPhase.instance);
      expect(filledKeys(state)).toEqual([]);
      expect(state.tray).toEqual(tray);
      expect(state.streak).toBe(0);
      expect(publisher.events).toEqual([]);
    }
  });

  it('should_count_one_line_and_score_one_line_when_the_topology_walks_the_line_from_its_other_end', () => {
    // Gap G107.6 (issue #134). `GridTopology.line()` promises the cells in order, not the start end.
    // This square double walks a line from its far end when the cell has an odd index on the axis.
    const reversing: GridTopology<SquareCoord, SquareAxis, SquareDirection> = {
      ...squareTopology,
      *line(axis, through, contains) {
        const cells = [...squareTopology.line(axis, through, contains)];
        // The line starts at the edge of the board, so the place of `through` is its index.
        const index = cells.findIndex((c) => c.equals(through));
        yield* index % 2 === 0 ? cells : cells.reverse();
      },
    };
    const probe = linesState(reversing, 3, { tray: [] });
    const { engine } = linesGame(
      linesState(reversing, 3, { filled: [square(1, 0), square(2, 0)], tray: [one, one] }),
      new ComboMultiplierDecorator(new LinesScoring<SquareCoord>()),
    );

    engine.play(new PlacePiece(0, origin));

    const state = engine.snapshot();
    expect(keys([...probe.snapshot().board.line(SquareAxis.col, square(1, 0))])).toEqual(
      keys([...probe.snapshot().board.line(SquareAxis.col, origin)]),
    );
    expect(
      probe.snapshot().board.line(SquareAxis.col, square(1, 0))[Symbol.iterator]().next().value,
    ).toEqual(square(2, 0));
    expect(state.linesCleared).toBe(1);
    expect(state.streak).toBe(1);
    expect(filledKeys(state)).toEqual([]);
    // One placed cell and one line with factor 1: 1 + 10.
    expect(state.score).toEqual(Score.of(11));
  });

  it('should_count_one_line_and_score_one_line_when_a_full_cell_lies_alone_on_two_axes', () => {
    // Issue #140: the set of its cell keys names a line, without the axis (decision on #134).
    // On a 1 × 1 board the only cell is a line of one cell on the col axis and on the row axis.
    // Both lines hold the same cell, so they are one line.
    const probe = linesState(squareTopology, 1, { tray: [] });
    const { engine } = linesGame(
      linesState(squareTopology, 1, { tray: [one, one] }),
      new ComboMultiplierDecorator(new LinesScoring<SquareCoord>()),
    );

    engine.play(new PlacePiece(0, origin));

    const state = engine.snapshot();
    for (const axis of squareTopology.axes()) {
      expect(keys([...probe.snapshot().board.line(axis, origin)])).toEqual(keys([origin]));
    }
    expect(state.linesCleared).toBe(1);
    expect(state.streak).toBe(1);
    expect(filledKeys(state)).toEqual([]);
    // One placed cell and one line with factor 1: 1 + 10.
    expect(state.score).toEqual(Score.of(11));
  });
});

// R7: the engine plays a turn on a copy of its state. The Lines state changes in place,
// so a turn that throws after the placement changed the copy leaves the state of the game.
describe('LinesRules atomic turn', () => {
  it('should_keep_the_snapshot_when_the_turn_throws_after_the_piece_changed_the_state', () => {
    const failing: IScoringPolicy<LinesState<SquareCoord>> = {
      score: () => {
        throw new Error('The scoring fails.');
      },
    };
    const start = linesFactory(5).createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine } = linesGame(start, failing);
    const facts = (state: LinesSnapshot<SquareCoord>) => ({
      cells: state.board.cells(),
      tray: [...state.tray],
      nextPiece: state.source.take().piece,
      counts: [state.streak, state.linesCleared, state.cellsPlaced],
      score: state.score,
    });
    const before = facts(engine.snapshot());

    expect(() => engine.play(firstValidMove(new LinesRules<SquareCoord>(), start))).toThrow(
      'The scoring fails.',
    );
    expect(facts(engine.snapshot())).toEqual(before);
  });
});
