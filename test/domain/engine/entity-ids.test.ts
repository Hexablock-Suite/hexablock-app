/** @jest-environment node */
import { BoardId } from '../../../src/domain/engine/board-id';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import { LevelTimerId } from '../../../src/domain/engine/level-timer-id';
import {
  BOARD_ID,
  CountingBoardIds,
  CountingStateIds,
  CountingTimerIds,
  STATE_ID,
  TIMER_ID,
} from '../../support/engine/entity-ids';

// The ids of the three entities inside the aggregate (classes.md decisions 7, 19 and 26):
// `BoardId` names one board, `GameStateId` names one state of a game,
// and `LevelTimerId` names the timer of one timed game (issue #214).
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

describe('LevelTimerId', () => {
  it('should_throw_a_range_error_when_the_value_is_empty_or_blank', () => {
    for (const value of ['', ' ', '\t\n']) {
      expect(() => LevelTimerId.of(value)).toThrow(
        new RangeError('A level timer id cannot be empty.'),
      );
    }
  });

  it('should_be_equal_in_both_directions_when_two_ids_hold_the_same_value', () => {
    const first = LevelTimerId.of('timer-a');
    const second = LevelTimerId.of('timer-a');

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_hold_different_values', () => {
    const first = LevelTimerId.of('timer-a');

    for (const other of [
      LevelTimerId.of('timer-b'),
      LevelTimerId.of('TIMER-A'),
      LevelTimerId.of('timer-a '),
    ]) {
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `LevelTimerId.value` is private.
      () => TIMER_ID.value,
    ];

    expect(readers).toHaveLength(1);
  });
});

// The generators are engine interfaces, as `MatchIdGenerator` is. Layer 4 implements them.
// This suite pins the test doubles that the other suites inject.
describe('CountingBoardIds, CountingStateIds and CountingTimerIds', () => {
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

  it('should_give_a_new_timer_id_when_the_timer_generator_is_asked_again', () => {
    const timers = new CountingTimerIds();

    const [first, second] = [timers.next(), timers.next()];

    expect([
      first.equals(LevelTimerId.of('timer-1')),
      second.equals(LevelTimerId.of('timer-2')),
      first.equals(second),
    ]).toEqual([true, true, false]);
  });
});
