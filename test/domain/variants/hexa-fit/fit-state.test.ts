/** @jest-environment node */
import { CoordKey } from '../../../../src/domain/engine/geometry/coord-key';
import { Moves } from '../../../../src/domain/shared/moves';
import { Score } from '../../../../src/domain/shared/score';
import { Turns } from '../../../../src/domain/engine/geometry/turns';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { Placement } from '../../../../src/domain/variants/hexa-fit/placement';
import { square, squareTopology } from '../../../support/engine/square-topology';
import { A, B } from '../../../support/variants/hexa-fit/fit-game';
import { fitFactory, threeDominoFitFactory } from '../../../support/variants/hexa-fit/fit-game';
import { firstValidMove, playedOn } from '../../../support/engine/variant-game';
import { GameStateId } from '../../../../src/domain/engine/board/game-state-id';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';
import { MATCH_ID } from '../../../support/engine/match-id';
import { delivered } from '../../../support/engine/value-receiver';

// R7: the Fit state is an entity. The engine adds the points of a turn through `addPoints()`.

describe('FitState', () => {
  it('should_add_the_points_of_each_turn_when_points_are_added', () => {
    const state = fitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    state.addPoints(Score.of(3));
    state.addPoints(Score.of(0));
    state.addPoints(Score.of(2));

    expect(state.snapshot().scoreSoFar()).toEqual(Score.of(5));
  });

  it('should_throw_and_keep_the_score_when_the_total_passes_the_largest_safe_integer', () => {
    const state = fitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    state.addPoints(Score.of(Number.MAX_SAFE_INTEGER));

    expect(() => state.addPoints(Score.of(1))).toThrow(
      new RangeError('The sum of two scores cannot pass the largest safe integer.'),
    );
    expect(state.snapshot().scoreSoFar()).toEqual(Score.of(Number.MAX_SAFE_INTEGER));
  });

  // The state has its own `GameStateId`, and it still knows its match (classes.md decision 26).
  it('should_be_the_same_state_when_two_states_have_one_state_id_whatever_they_hold', () => {
    const factory = fitFactory();
    const rules = factory.createRules();
    const first = factory.createInitialState(
      MATCH_ID,
      GameStateId.of(MatchId.of('match-a')),
      BOARD_ID,
    );
    const moved = playedOn(rules, first, firstValidMove(rules, first));
    const other = threeDominoFitFactory().createInitialState(
      MATCH_ID,
      GameStateId.of(MatchId.of('match-a')),
      BOARD_ID,
    );

    expect([first.equals(moved), moved.equals(first), first.equals(first.clone())]).toEqual([
      true,
      true,
      true,
    ]);
    expect([first.equals(other), other.equals(first)]).toEqual([true, true]);
  });

  it('should_be_another_state_when_two_states_of_one_match_have_different_state_ids', () => {
    const factory = fitFactory();
    const first = factory.createInitialState(
      MatchId.of('m-a'),
      GameStateId.of(MatchId.of('match-a')),
      BOARD_ID,
    );
    const second = factory.createInitialState(
      MatchId.of('m-a'),
      GameStateId.of(MatchId.of('match-b')),
      BOARD_ID,
    );

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([
      first.belongsTo(MatchId.of('m-a')),
      second.belongsTo(MatchId.of('m-a')),
      first.belongsTo(MatchId.of('m-b')),
    ]).toEqual([true, true, false]);
  });

  // Issue #237: the error carries the id as its `cause`, and the edge delivers its text.
  it('should_throw_a_range_error_that_carries_the_id_and_keep_the_board_when_a_piece_of_no_level_piece_is_placed', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const unknown = PieceId.of('z');
    const place = () =>
      state.place(unknown, Placement.of(Turns.of(0), square(0, 0), squareTopology));

    expect(place).toThrow(
      new RangeError('The level has no piece with this id.', { cause: unknown }),
    );
    expect(state.snapshot().boardCopy().occupiedCells()).toEqual([]);
    expect(state.placed()).toEqual([]);
  });

  // The state keeps its object: `place()`, `remove()` and `countMove()` change it in place.
  it('should_change_the_state_in_place_when_a_piece_is_placed_counted_and_removed', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const board = state.snapshot().boardCopy();
    const keys = () =>
      state
        .snapshot()
        .boardCopy()
        .occupiedCells()
        .map(([c, id]) => `${delivered(squareTopology.key(c))}=${delivered(id)}`);
    const results: unknown[] = [];

    results.push(state.place(A, Placement.of(Turns.of(0), square(2, 0), squareTopology)));
    results.push(state.place(B, Placement.of(Turns.of(0), square(0, 0), squareTopology)));
    results.push(state.countMove());
    const placed = { cells: keys(), placed: state.placed(), moves: state.snapshot().moveCount() };
    results.push(state.remove(A));

    expect(results).toEqual([undefined, undefined, undefined, undefined]);
    // The board keeps its id: the same board changes in place.
    expect(state.snapshot().boardCopy().equals(board)).toBe(true);
    expect(placed).toEqual({
      cells: ['2,0=a', '3,0=a', '0,0=b', '1,0=b'],
      placed: [A, B],
      moves: Moves.of(1),
    });
    expect([keys(), state.placed(), state.snapshot().moveCount()]).toEqual([
      ['0,0=b', '1,0=b'],
      [B],
      Moves.of(1),
    ]);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_a_placed_piece_leaves_the_figure', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    state.place(B, Placement.of(Turns.of(0), square(0, 0), squareTopology));
    const before = { cells: state.snapshot().boardCopy().occupiedCells(), placed: state.placed() };

    expect(() => state.place(A, Placement.of(Turns.of(0), square(5, 0), squareTopology))).toThrow(
      new RangeError('The coordinate is outside the board.', { cause: CoordKey.of('6,0') }),
    );
    expect({ cells: state.snapshot().boardCopy().occupiedCells(), placed: state.placed() }).toEqual(
      before,
    );
  });
});
