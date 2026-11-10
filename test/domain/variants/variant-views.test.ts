/** @jest-environment node */
import { FixedListPieceSource } from '../../../src/domain/engine/piece-source';
import { MergeState } from '../../../src/domain/variants/hexa-merge/merge-state';
import { GoalCount } from '../../../src/domain/variants/hexa-sort/goal-count';
import { SortState } from '../../../src/domain/variants/hexa-sort/sort-state';
import { square, squareTopology } from '../../support/engine/square-topology';
import { firstValidMove } from '../../support/engine/variant-game';
import { A, fitFactory } from '../../support/variants/hexa-fit/fit-game';
import { linesState, piece } from '../../support/variants/hexa-lines/lines-game';
import { mergeState, noNewTiles } from '../../support/variants/hexa-merge/merge-game';
import { row, stack, stackPiece, tiles } from '../../support/variants/hexa-sort/sort-game';
import { PlacePiece } from '../../../src/domain/variants/hexa-lines/place-piece';
import { MATCH_ID } from '../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../support/engine/entity-ids';

// The photo of each variant state builds its own view from values that the state holds
// (issue 158, classes.md decisions 29 and 34). The view is plain data that later changes
// of the state do not reach.

function expectFrozen(...parts: readonly object[]): void {
  for (const part of parts) expect(Object.isFrozen(part)).toBe(true);
}

describe('the view of each variant state', () => {
  it('should_build_a_frozen_copy_of_the_tray_when_a_lines_state_builds_its_view', () => {
    const first = piece(square(0, 0));
    const second = piece(square(0, 0), square(1, 0));
    const state = linesState(squareTopology, 2, { tray: [first, second] });

    const view = state.snapshot().view();

    expect(view).toEqual({ tray: [first, second] });
    expectFrozen(view, view.tray);

    // A later placement takes a piece from the tray, and it must not reach this view.
    state.placePiece(new PlacePiece(0, square(0, 0)));

    expect(view.tray).toEqual([first, second]);
    expect(state.snapshot().view().tray).toEqual([second]);
  });

  it('should_build_the_view_from_the_offered_stack_and_the_goals_when_a_sort_state_builds_its_view', () => {
    const offered = stackPiece(stack('red'));
    const goalsNeeded = GoalCount.of(3);
    const state = SortState.start({
      stateId: STATE_ID,
      matchId: MATCH_ID,
      board: row(2, [[square(0, 0), stack(...tiles('red', 9))]]),
      source: new FixedListPieceSource([offered, offered]),
      goalsNeeded,
    });
    // One placement makes a run of 10 tiles, and the clear counts one goal.
    state.placeOfferedStack(square(1, 0));
    state.moveRun(square(1, 0), square(0, 0));
    state.clearStack(square(0, 0));

    const view = state.snapshot().view();

    expect(view).toStrictEqual({ offered, goalsDone: 1, goalsNeeded });
    expectFrozen(view);

    // The source ends, so the next offer is none. A later change must not reach this view.
    state.offerNext();

    expect(view).toStrictEqual({ offered, goalsDone: 1, goalsNeeded });
    expect(state.snapshot().view()).toStrictEqual({
      offered: undefined,
      goalsDone: 1,
      goalsNeeded,
    });
  });

  it('should_build_the_view_from_the_remaining_and_placed_pieces_when_a_fit_state_builds_its_view', () => {
    const factory = fitFactory();
    const rules = factory.createRules();
    const start = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const domino = start.piece(A);

    const before = start.snapshot().view();
    const after = rules.apply(start, firstValidMove(rules, start)).snapshot().view();

    expect(before).toEqual({ remaining: [domino], placed: [] });
    expect(after).toEqual({ remaining: [], placed: [A] });
    expectFrozen(before, before.remaining, before.placed, after, after.remaining, after.placed);
  });

  it('should_build_the_view_from_the_target_flag_when_a_merge_state_builds_its_view', () => {
    const notReached = mergeState([]).snapshot().view();
    const reached = new MergeState(
      STATE_ID,
      MATCH_ID,
      mergeState([]).snapshot().board.clone(),
      noNewTiles(),
      true,
    )
      .snapshot()
      .view();

    expect(notReached).toEqual({ targetReached: false });
    expect(reached).toEqual({ targetReached: true });
    expectFrozen(notReached, reached);
  });
});
