/** @jest-environment node */
import { Turns } from '../../../../src/domain/engine/turns';
import { Placement } from '../../../../src/domain/variants/hexa-fit/placement';
import { square, squareTopology } from '../../../support/engine/square-topology';
import { A, B } from '../../../support/variants/hexa-fit/fit-game';
import { fitFactory, threeDominoFitFactory } from '../../../support/variants/hexa-fit/fit-game';
import { firstValidMove } from '../../../support/engine/variant-game';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';
import { MATCH_ID } from '../../../support/engine/match-id';

// R7: the Fit state is an entity. The engine adds the points of a turn through `addPoints()`.

describe('FitState', () => {
  it('should_add_the_points_and_refuse_points_that_are_not_finite_when_points_are_added', () => {
    const state = fitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    state.addPoints(3);
    state.addPoints(-1);

    expect(state.score).toBe(2);
    expect(() => state.addPoints(Number.POSITIVE_INFINITY)).toThrow(
      new RangeError('The points of a turn must be a finite number, not Infinity.'),
    );
    expect(state.score).toBe(2);
  });

  // The state has its own `GameStateId`, and it still knows its match (classes.md decision 26).
  it('should_be_the_same_state_when_two_states_have_one_state_id_whatever_they_hold', () => {
    const factory = fitFactory();
    const rules = factory.createRules();
    const first = factory.createInitialState(MATCH_ID, GameStateId.of('state-a'), BOARD_ID);
    const moved = rules.apply(first, firstValidMove(rules, first));
    const other = threeDominoFitFactory().createInitialState(
      MATCH_ID,
      GameStateId.of('state-a'),
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
      GameStateId.of('state-a'),
      BOARD_ID,
    );
    const second = factory.createInitialState(
      MatchId.of('m-a'),
      GameStateId.of('state-b'),
      BOARD_ID,
    );

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([
      first.belongsTo(MatchId.of('m-a')),
      second.belongsTo(MatchId.of('m-a')),
      first.belongsTo(MatchId.of('m-b')),
    ]).toEqual([true, true, false]);
  });

  // The state keeps its object: `place()`, `remove()` and `countMove()` change it in place.
  it('should_change_the_state_in_place_when_a_piece_is_placed_counted_and_removed', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const board = state.board;
    const keys = () => state.board.cells().map(([c, id]) => `${squareTopology.key(c)}=${id.value}`);
    const results: unknown[] = [];

    results.push(state.place(A, Placement.of(Turns.of(0), square(2, 0), squareTopology)));
    results.push(state.place(B, Placement.of(Turns.of(0), square(0, 0), squareTopology)));
    results.push(state.countMove());
    const placed = { cells: keys(), placed: state.placed(), moves: state.moves };
    results.push(state.remove(A));

    expect(results).toEqual([undefined, undefined, undefined, undefined]);
    expect(state.board).toBe(board);
    expect(placed).toEqual({
      cells: ['2,0=a', '3,0=a', '0,0=b', '1,0=b'],
      placed: [A, B],
      moves: 1,
    });
    expect([keys(), state.placed(), state.moves]).toEqual([['0,0=b', '1,0=b'], [B], 1]);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_a_placed_piece_leaves_the_figure', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    state.place(B, Placement.of(Turns.of(0), square(0, 0), squareTopology));
    const before = { cells: state.board.cells(), placed: state.placed() };

    expect(() => state.place(A, Placement.of(Turns.of(0), square(5, 0), squareTopology))).toThrow(
      new RangeError('The coordinate 6,0 is outside the board.'),
    );
    expect({ cells: state.board.cells(), placed: state.placed() }).toEqual(before);
  });
});
