/** @jest-environment node */
import { Board } from '../../../../src/domain/engine/board';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { Color } from '../../../../src/domain/engine/color';
import { LinesState } from '../../../../src/domain/variants/hexa-lines/lines-state';
import { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  filledKeys,
  linesState,
  piece,
  red,
} from '../../../support/variants/hexa-lines/lines-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// R7: the Lines state is an entity. It changes only through its business methods,
// and a refused input leaves the whole state as it was.

const one = piece(square(0, 0));
const domino = piece(square(0, 0), square(1, 0));

// Everything that a refused input must leave unchanged.
function facts(state: LinesState<SquareCoord>) {
  return {
    filled: filledKeys(state),
    tray: [...state.tray],
    left: state.source.hasNext(),
    streak: state.streak,
    linesCleared: state.linesCleared,
    cellsPlaced: state.cellsPlaced,
    score: state.score,
  };
}

function emptyBoard(size: number): Board<Color, SquareCoord, string> {
  return new Board<Color, SquareCoord, string>(
    BOARD_ID,
    squareTopology.region(RegionSize.of(size)),
    squareTopology,
  );
}

describe('LinesState', () => {
  it('should_put_the_piece_on_the_board_and_take_it_from_the_tray_when_a_tray_piece_is_placed', () => {
    const state = linesState(squareTopology, 3, { tray: [domino, one], source: [one] });

    state.placePiece(new PlacePiece(0, square(1, 2)));

    expect(filledKeys(state)).toEqual(['1,2', '2,2']);
    expect(state.board.get(square(1, 2))).toBe(red);
    expect(state.cellsPlaced).toBe(2);
    expect(state.tray).toEqual([one]);
    expect(state.source.hasNext()).toBe(true);
  });

  it('should_fill_the_tray_from_the_source_when_the_last_tray_piece_is_placed', () => {
    const [a, b, c, d] = [piece(square(0, 0)), piece(square(0, 0)), piece(square(0, 0)), one];
    const state = linesState(squareTopology, 3, { tray: [one], source: [a!, b!, c!, d] });

    state.placePiece(new PlacePiece(0, square(0, 0)));

    expect(state.tray).toEqual([a, b, c]);
    expect(state.source.hasNext()).toBe(true);
    expect(state.cellsPlaced).toBe(1);
  });

  it('should_fill_the_tray_with_fewer_pieces_when_the_source_ends_first', () => {
    const state = linesState(squareTopology, 3, { tray: [one], source: [domino] });

    state.placePiece(new PlacePiece(0, square(0, 0)));

    expect(state.tray).toEqual([domino]);
    expect(state.source.hasNext()).toBe(false);
  });

  it('should_draw_a_full_tray_when_a_game_starts', () => {
    const state = LinesState.start(
      STATE_ID,
      MATCH_ID,
      emptyBoard(2),
      new FixedListPieceSource([one, domino, one, domino]),
    );

    expect(state.tray).toEqual([one, domino, one]);
    expect(state.source.hasNext()).toBe(true);
    expect(facts(state)).toMatchObject({ streak: 0, linesCleared: 0, cellsPlaced: 0, score: 0 });
  });

  it('should_tell_whether_a_tray_piece_fits_when_a_placement_is_asked', () => {
    const state = linesState(squareTopology, 3, { filled: [square(1, 1)], tray: [domino, one] });

    expect(state.canPlace(new PlacePiece(0, square(0, 0)))).toBe(true);
    expect(state.canPlace(new PlacePiece(0, square(0, 1)))).toBe(false);
    expect(state.canPlace(new PlacePiece(0, square(2, 0)))).toBe(false);
    expect(state.canPlace(new PlacePiece(1, square(1, 1)))).toBe(false);
    expect(state.canPlace(new PlacePiece(2, square(0, 0)))).toBe(false);
    expect(state.canPlace(new PlacePiece(0.5, square(0, 0)))).toBe(false);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_tray_has_no_piece_at_the_index', () => {
    const state = linesState(squareTopology, 3, { tray: [one], source: [one] });
    const before = facts(state);

    for (const index of [1, -1, 0.5, Number.NaN]) {
      expect(() => state.placePiece(new PlacePiece(index, square(0, 0)))).toThrow(
        new RangeError(`The tray has no piece at index ${index}.`),
      );
    }
    expect(facts(state)).toEqual(before);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_piece_does_not_fit', () => {
    const state = linesState(squareTopology, 3, { filled: [square(1, 1)], tray: [domino] });
    const before = facts(state);

    expect(() => state.placePiece(new PlacePiece(0, square(0, 1)))).toThrow(
      new RangeError('The piece at tray index 0 does not fit at 0,1.'),
    );
    expect(() => state.placePiece(new PlacePiece(0, square(2, 2)))).toThrow(
      new RangeError('The piece at tray index 0 does not fit at 2,2.'),
    );
    expect(facts(state)).toEqual(before);
  });

  it('should_vacate_the_lines_and_count_the_streak_when_full_lines_are_cleared', () => {
    const row = [square(0, 0), square(1, 0), square(2, 0)];
    const column = [square(0, 0), square(0, 1), square(0, 2)];
    const state = linesState(squareTopology, 3, {
      filled: [...row, square(0, 1), square(0, 2), square(2, 2)],
      tray: [one],
    });

    // The two lines share the cell (0,0). It is vacated once.
    state.clearLines([row, column]);

    expect(filledKeys(state)).toEqual(['2,2']);
    expect(state.linesCleared).toBe(2);
    expect(state.streak).toBe(1);

    state.clearLines([]);

    expect(filledKeys(state)).toEqual(['2,2']);
    expect(state.linesCleared).toBe(0);
    expect(state.streak).toBe(0);
  });

  it('should_add_one_to_the_streak_when_two_placements_in_a_row_clear_a_line', () => {
    const state = linesState(squareTopology, 2, {
      filled: [square(0, 0), square(1, 0), square(0, 1), square(1, 1)],
      tray: [one],
    });

    state.clearLines([[square(0, 0), square(1, 0)]]);
    state.clearLines([[square(0, 1), square(1, 1)]]);

    expect(state.streak).toBe(2);
    expect(state.linesCleared).toBe(1);
    expect(filledKeys(state)).toEqual([]);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_a_cleared_line_holds_a_free_cell', () => {
    const state = linesState(squareTopology, 3, {
      filled: [square(0, 0), square(1, 0)],
      tray: [one],
    });
    const before = facts(state);

    expect(() => state.clearLines([[square(0, 0), square(1, 0), square(2, 0)]])).toThrow(
      new RangeError('A cleared line holds the free cell 2,0.'),
    );
    expect(() => state.clearLines([[square(0, 0), square(5, 0)]])).toThrow(
      new RangeError('A cleared line holds the free cell 5,0.'),
    );
    expect(facts(state)).toEqual(before);
  });

  it('should_add_the_points_to_the_score_when_points_are_added', () => {
    const state = linesState(squareTopology, 2, { tray: [] });

    state.addPoints(12);
    state.addPoints(0);
    state.addPoints(3);

    expect(state.score).toBe(15);
  });

  it('should_throw_a_range_error_and_keep_the_score_when_the_points_are_not_finite', () => {
    const state = linesState(squareTopology, 2, { tray: [] });
    state.addPoints(5);

    for (const points of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => state.addPoints(points)).toThrow(
        new RangeError(`The points of a turn must be a finite number, not ${points}.`),
      );
    }
    expect(state.score).toBe(5);
  });

  it('should_throw_a_range_error_when_a_state_is_built_in_an_invalid_form', () => {
    const board = emptyBoard(2);
    const source = new FixedListPieceSource([one]);

    expect(() => new LinesState(STATE_ID, MATCH_ID, board, [one, one, one, one], source)).toThrow(
      new RangeError('A Lines tray holds at most 3 pieces, not 4.'),
    );
    expect(() => new LinesState(STATE_ID, MATCH_ID, board, [], source, -1)).toThrow(
      new RangeError('The streak of a Lines state must be a whole number of 0 or more, not -1.'),
    );
    expect(() => new LinesState(STATE_ID, MATCH_ID, board, [], source, 0, 1.5)).toThrow(
      new RangeError(
        'The linesCleared of a Lines state must be a whole number of 0 or more, not 1.5.',
      ),
    );
    expect(() => new LinesState(STATE_ID, MATCH_ID, board, [], source, 0, 0, Number.NaN)).toThrow(
      new RangeError(
        'The cellsPlaced of a Lines state must be a whole number of 0 or more, not NaN.',
      ),
    );
    expect(
      () =>
        new LinesState(STATE_ID, MATCH_ID, board, [], source, 0, 0, 0, Number.POSITIVE_INFINITY),
    ).toThrow(new RangeError('The score of a state must be a finite number, not Infinity.'));
    expect(
      new LinesState(STATE_ID, MATCH_ID, board, [one, domino], source, 2, 1, 3, 7),
    ).toMatchObject({
      streak: 2,
      linesCleared: 1,
      cellsPlaced: 3,
      score: 7,
    });
  });

  // The state has its own `GameStateId`, and it still knows its match (classes.md decision 26).
  it('should_be_the_same_state_when_two_states_have_one_state_id_whatever_they_hold', () => {
    const first = linesState(squareTopology, 3, {
      tray: [one],
      stateId: GameStateId.of('state-a'),
    });
    const second = linesState(squareTopology, 2, {
      filled: [square(0, 0)],
      tray: [],
      stateId: GameStateId.of('state-a'),
    });
    first.addPoints(9);

    expect([first.equals(second), second.equals(first), first.equals(first.clone())]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_another_state_when_two_states_of_one_match_have_different_state_ids', () => {
    const first = linesState(squareTopology, 3, {
      tray: [one],
      matchId: MatchId.of('match-a'),
      stateId: GameStateId.of('state-a'),
    });
    const second = linesState(squareTopology, 3, {
      tray: [one],
      matchId: MatchId.of('match-a'),
      stateId: GameStateId.of('state-b'),
    });

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([
      first.belongsTo(MatchId.of('match-a')),
      second.belongsTo(MatchId.of('match-a')),
      first.belongsTo(MatchId.of('match-b')),
    ]).toEqual([true, true, false]);
  });
});
