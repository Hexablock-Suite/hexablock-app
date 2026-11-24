/** @jest-environment node */
import { CoordKey } from '../../../../src/domain/engine/coord-key';
import { Moves } from '../../../../src/domain/engine/moves';
import { Score } from '../../../../src/domain/engine/score';
import { ClearedStacks } from '../../../../src/domain/variants/hexa-sort/cleared-stacks';
import { SortRules } from '../../../../src/domain/variants/hexa-sort/sort-rules';
import type { SortState } from '../../../../src/domain/variants/hexa-sort/sort-state';
import { TileCount } from '../../../../src/domain/variants/hexa-sort/tile-count';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { square, type SquareCoord } from '../../../support/engine/square-topology';
import {
  names,
  place,
  row,
  sortState,
  stack,
  tiles,
} from '../../../support/variants/hexa-sort/sort-game';

// R7: the Sort state is an entity. It changes only through its business methods,
// and a refused input leaves the whole state as it was.

// Everything that a refused input must leave unchanged.
function facts(state: SortState<SquareCoord>) {
  const offered = state.snapshot().offeredStack();
  return {
    board: state
      .snapshot()
      .boardCopy()
      .occupiedCells()
      .map(([at, cell]) => [at, names(cell)]),
    offered: offered === undefined ? undefined : names(offered.occupant()),
    left: state.snapshot().pieceSource().hasNext(),
    goalsDone: state.snapshot().goalsReached(),
    clearedTiles: [...state.snapshot().clearedStackHeights()],
    placedAt: state.snapshot().lastPlacedAt(),
    score: state.snapshot().scoreSoFar(),
  };
}

describe('SortState', () => {
  it('should_put_the_offered_stack_on_the_cell_and_offer_the_next_when_the_stack_is_placed', () => {
    const state = sortState({ board: row(3), offered: [stack('red'), stack('blue', 'blue')] });

    state.placeOfferedStack(square(1, 0));

    expect(names(state.snapshot().boardCopy().occupantAt(square(1, 0)))).toEqual(['red']);
    expect(state.snapshot().lastPlacedAt()).toEqual(square(1, 0));
    expect(state.snapshot().clearedStackHeights()).toEqual([]);
    expect(names(state.snapshot().offeredStack()?.occupant())).toEqual(['blue', 'blue']);
    expect(state.snapshot().pieceSource().hasNext()).toBe(false);
  });

  it('should_offer_no_stack_when_the_last_stack_is_placed', () => {
    const state = sortState({ board: row(2), offered: [stack('red')] });

    state.placeOfferedStack(square(0, 0));

    expect(state.snapshot().offeredStack()).toBeUndefined();
  });

  it('should_place_the_stack_when_the_cell_holds_an_empty_stack', () => {
    const state = sortState({
      board: row(2, [[square(0, 0), stack()]]),
      offered: [stack('red')],
    });

    state.placeOfferedStack(square(0, 0));

    expect(names(state.snapshot().boardCopy().occupantAt(square(0, 0)))).toEqual(['red']);
  });

  it('should_tell_whether_the_offered_stack_can_go_on_a_cell_when_a_cell_is_asked', () => {
    const state = sortState({
      board: row(3, [
        [square(0, 0), stack('red')],
        [square(1, 0), stack()],
      ]),
      offered: [stack('blue')],
    });
    const ended = sortState({ board: row(3), offered: [] });

    expect(state.canPlace(square(0, 0))).toBe(false);
    expect(state.canPlace(square(1, 0))).toBe(true);
    expect(state.canPlace(square(2, 0))).toBe(true);
    expect(state.canPlace(square(3, 0))).toBe(false);
    expect(ended.canPlace(square(0, 0))).toBe(false);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_stack_cannot_go_on_the_cell', () => {
    const state = sortState({
      board: row(2, [[square(0, 0), stack('red')]]),
      offered: [stack('blue'), stack('green')],
    });
    const ended = sortState({ board: row(2), offered: [] });
    const before = facts(state);
    const endedBefore = facts(ended);

    expect(() => state.placeOfferedStack(square(0, 0))).toThrow(
      new RangeError('The cell already holds a stack.', { cause: CoordKey.of('0,0') }),
    );
    expect(() => state.placeOfferedStack(square(5, 0))).toThrow(
      new RangeError('The coordinate is outside the board.', { cause: CoordKey.of('5,0') }),
    );
    expect(() => ended.placeOfferedStack(square(0, 0))).toThrow(
      new RangeError('No stack is on offer.'),
    );
    expect(facts(state)).toEqual(before);
    expect(facts(ended)).toEqual(endedBefore);
  });

  it('should_move_the_top_run_onto_the_other_stack_when_a_run_moves', () => {
    const state = sortState({
      board: row(3, [
        [square(0, 0), stack('blue', 'red', 'red')],
        [square(1, 0), stack('green', 'red')],
      ]),
    });

    state.moveRun(square(0, 0), square(1, 0));

    expect(names(state.snapshot().boardCopy().occupantAt(square(0, 0)))).toEqual(['blue']);
    expect(names(state.snapshot().boardCopy().occupantAt(square(1, 0)))).toEqual([
      'green',
      'red',
      'red',
      'red',
    ]);
    expect(state.snapshot().goalsReached()).toEqual(ClearedStacks.of(0));
    expect(state.snapshot().clearedStackHeights()).toEqual([]);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_run_cannot_move', () => {
    const state = sortState({
      board: row(3, [
        [square(0, 0), stack('red')],
        [square(1, 0), stack()],
      ]),
    });
    const before = facts(state);

    expect(() => state.moveRun(square(1, 0), square(0, 0))).toThrow(
      new RangeError('The cell has no stack to move.', { cause: CoordKey.of('1,0') }),
    );
    expect(() => state.moveRun(square(2, 0), square(0, 0))).toThrow(
      new RangeError('The cell has no stack to move.', { cause: CoordKey.of('2,0') }),
    );
    expect(() => state.moveRun(square(0, 0), square(0, 0))).toThrow(
      new RangeError('A run cannot move to its own cell.', { cause: CoordKey.of('0,0') }),
    );
    expect(() => state.moveRun(square(0, 0), square(4, 0))).toThrow(
      new RangeError('The coordinate is outside the board.', { cause: CoordKey.of('4,0') }),
    );
    expect(facts(state)).toEqual(before);
  });

  it('should_empty_the_stack_and_count_one_goal_when_a_stack_is_cleared', () => {
    const state = sortState({
      board: row(2, [[square(0, 0), stack('blue', ...tiles('red', 10))]]),
      offered: [stack('red')],
    });
    state.placeOfferedStack(square(1, 0));

    state.clearStack(square(0, 0));

    expect(state.snapshot().boardCopy().occupantAt(square(0, 0))?.isEmpty()).toBe(true);
    expect(state.snapshot().boardCopy().occupiedCells()).toHaveLength(2);
    expect(state.snapshot().goalsReached()).toEqual(ClearedStacks.of(1));
    expect(state.snapshot().clearedStackHeights()).toEqual([TileCount.of(11)]);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_cell_has_no_stack_to_clear', () => {
    const state = sortState({
      board: row(3, [[square(0, 0), stack()]]),
    });
    const before = facts(state);

    expect(() => state.clearStack(square(0, 0))).toThrow(
      new RangeError('The cell has no stack to clear.', { cause: CoordKey.of('0,0') }),
    );
    expect(() => state.clearStack(square(1, 0))).toThrow(
      new RangeError('The cell has no stack to clear.', { cause: CoordKey.of('1,0') }),
    );
    expect(facts(state)).toEqual(before);
  });

  it('should_add_the_points_and_refuse_a_total_above_the_largest_safe_integer_when_points_are_added', () => {
    const state = sortState({ board: row(2) });

    state.addPoints(Score.of(100));
    state.addPoints(Score.of(10));

    expect(state.snapshot().scoreSoFar()).toEqual(Score.of(110));
    expect(() => state.addPoints(Score.of(Number.MAX_SAFE_INTEGER))).toThrow(
      new RangeError('The sum of two scores cannot pass the largest safe integer.'),
    );
    expect(state.snapshot().scoreSoFar()).toEqual(Score.of(110));
  });

  it('should_recover_the_saved_move_count_when_restoring_an_earlier_snapshot', () => {
    const state = sortState({ board: row(3), offered: [stack('red'), stack('blue')] });
    const rules = new SortRules<SquareCoord>();
    rules.playTurn(state, place(0));
    const saved = state.snapshot();
    rules.playTurn(state, place(2));
    const later = state.snapshot();

    state.restore(saved);

    expect(saved.moveCount()).toEqual(Moves.of(1));
    expect(later.moveCount()).toEqual(Moves.of(2));
    expect(state.snapshot().moveCount()).toEqual(Moves.of(1));
  });

  it('should_keep_the_move_count_independently_when_the_state_is_cloned', () => {
    const state = sortState({ board: row(3), offered: [stack('red'), stack('blue')] });
    const rules = new SortRules<SquareCoord>();
    rules.playTurn(state, place(0));
    const copy = state.clone();

    rules.playTurn(copy, place(2));

    expect(state.snapshot().moveCount()).toEqual(Moves.of(1));
    expect(copy.snapshot().moveCount()).toEqual(Moves.of(2));
  });

  // The state has its own `GameStateId`, and it still knows its match (classes.md decision 26).
  it('should_be_the_same_state_when_two_states_have_one_state_id_whatever_they_hold', () => {
    const stateId = GameStateId.of(MatchId.of('match-a'));
    const first = sortState({ board: row(2), offered: [stack('red')], stateId });
    const second = sortState({ board: row(3), stateId });
    first.placeOfferedStack(square(0, 0));

    expect([first.equals(second), second.equals(first), first.equals(first.clone())]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_another_state_when_two_states_of_one_match_have_different_state_ids', () => {
    const matchId = MatchId.of('m-a');
    const first = sortState({
      board: row(2),
      matchId,
      stateId: GameStateId.of(MatchId.of('match-a')),
    });
    const second = sortState({
      board: row(2),
      matchId,
      stateId: GameStateId.of(MatchId.of('match-b')),
    });

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([
      first.belongsTo(MatchId.of('m-a')),
      second.belongsTo(MatchId.of('m-a')),
      first.belongsTo(MatchId.of('m-b')),
    ]).toEqual([true, true, false]);
  });
});
