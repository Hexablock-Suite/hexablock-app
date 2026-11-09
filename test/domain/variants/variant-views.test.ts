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
import { row, stack, stackPiece } from '../../support/variants/hexa-sort/sort-game';

// Each variant state builds its own view from values it already holds (issue 158,
// classes.md decision 29). The view is plain data that later changes of the state do not reach.

function expectFrozen(...parts: readonly object[]): void {
  for (const part of parts) expect(Object.isFrozen(part)).toBe(true);
}

describe('the view of each variant state', () => {
  it('should_build_a_frozen_copy_of_the_tray_when_a_lines_state_builds_its_view', () => {
    const first = piece(square(0, 0));
    const second = piece(square(0, 0), square(1, 0));
    const state = linesState(squareTopology, 2, { tray: [first, second] });

    const view = state.view();

    expect(view).toEqual({ tray: [first, second] });
    expect(view.tray).not.toBe(state.tray);
    expectFrozen(view, view.tray);
    expect(Object.isFrozen(state.tray)).toBe(false);

    // The tray is public and mutable, so a later change must not reach this view.
    state.tray = [second];

    expect(view.tray).toEqual([first, second]);
  });

  it('should_build_the_view_from_the_offered_stack_and_the_goals_when_a_sort_state_builds_its_view', () => {
    const offered = stackPiece(stack('red'));
    const goalsNeeded = GoalCount.of(3);
    const state = SortState.start({
      board: row(2),
      source: new FixedListPieceSource([offered]),
      goalsNeeded,
    });
    state.goalsDone = 1;

    const view = state.view();

    expect(view).toStrictEqual({ offered, goalsDone: 1, goalsNeeded });
    expectFrozen(view);

    // `offered` and `goalsDone` are public and mutable, so a later change must not reach this view.
    state.goalsDone = 2;
    state.offerNext();

    expect(view).toStrictEqual({ offered, goalsDone: 1, goalsNeeded });
    expect(state.view()).toStrictEqual({ offered: undefined, goalsDone: 2, goalsNeeded });
  });

  it('should_build_the_view_from_the_remaining_and_placed_pieces_when_a_fit_state_builds_its_view', () => {
    const factory = fitFactory();
    const rules = factory.createRules();
    const start = factory.createInitialState();
    const domino = start.piece(A);

    const before = start.view();
    const after = rules.apply(start, firstValidMove(rules, start)).view();

    expect(before).toEqual({ remaining: [domino], placed: [] });
    expect(after).toEqual({ remaining: [], placed: [A] });
    expectFrozen(before, before.remaining, before.placed, after, after.remaining, after.placed);
  });

  it('should_build_the_view_from_the_target_flag_when_a_merge_state_builds_its_view', () => {
    const notReached = mergeState([]).view();
    const reached = new MergeState(mergeState([]).board, noNewTiles(), true).view();

    expect(notReached).toEqual({ targetReached: false });
    expect(reached).toEqual({ targetReached: true });
    expectFrozen(notReached, reached);
  });
});
