/** @jest-environment node */
import { BoardId } from '../../../src/domain/engine/board-id';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import {
  BOARD_ID,
  CountingBoardIds,
  CountingStateIds,
  STATE_ID,
} from '../../support/engine/entity-ids';

// The ids of the two entities inside the aggregate (classes.md decisions 7 and 26):
// `BoardId` names one board, and `GameStateId` names one state of a game.
// The system assigns each id through a generator, as it assigns a `MatchId`.

describe('BoardId', () => {
  it('should_throw_a_range_error_when_the_value_is_empty_or_blank', () => {
    for (const value of ['', ' ', '\t\n']) {
      expect(() => BoardId.of(value)).toThrow(new RangeError('A board id cannot be empty.'));
    }
  });

  it('should_be_equal_in_both_directions_when_two_ids_hold_the_same_value', () => {
    const first = BoardId.of('board-a');
    const second = BoardId.of('board-a');

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_hold_different_values', () => {
    const first = BoardId.of('board-a');

    for (const other of [BoardId.of('board-b'), BoardId.of('BOARD-A'), BoardId.of('board-a ')]) {
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `BoardId.value` is private.
      () => BOARD_ID.value,
    ];

    expect(readers).toHaveLength(1);
  });
});

describe('GameStateId', () => {
  it('should_throw_a_range_error_when_the_value_is_empty_or_blank', () => {
    for (const value of ['', ' ', '\t\n']) {
      expect(() => GameStateId.of(value)).toThrow(
        new RangeError('A game state id cannot be empty.'),
      );
    }
  });

  it('should_be_equal_in_both_directions_when_two_ids_hold_the_same_value', () => {
    const first = GameStateId.of('state-a');
    const second = GameStateId.of('state-a');

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_hold_different_values', () => {
    const first = GameStateId.of('state-a');

    for (const other of [
      GameStateId.of('state-b'),
      GameStateId.of('STATE-A'),
      GameStateId.of('state-a '),
    ]) {
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `GameStateId.value` is private.
      () => STATE_ID.value,
    ];

    expect(readers).toHaveLength(1);
  });
});

// The generators are engine interfaces, as `MatchIdGenerator` is. Layer 4 implements them.
// This suite pins the test doubles that the other suites inject.
describe('CountingBoardIds and CountingStateIds', () => {
  it('should_give_a_new_id_when_a_generator_is_asked_again', () => {
    const boards = new CountingBoardIds();
    const states = new CountingStateIds();

    const [firstBoard, secondBoard] = [boards.next(), boards.next()];
    const [firstState, secondState] = [states.next(), states.next()];

    expect([
      firstBoard.equals(BoardId.of('board-1')),
      secondBoard.equals(BoardId.of('board-2')),
      firstBoard.equals(secondBoard),
    ]).toEqual([true, true, false]);
    expect([
      firstState.equals(GameStateId.of('state-1')),
      secondState.equals(GameStateId.of('state-2')),
      firstState.equals(secondState),
    ]).toEqual([true, true, false]);
  });
});
