/** @jest-environment node */
import { BoardId } from '../../../src/domain/engine/board/board-id';
import { GameStateId } from '../../../src/domain/engine/board/game-state-id';
import { LevelTimerId } from '../../../src/domain/engine/turn/level-timer-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import { BOARD_ID, STATE_ID, TIMER_ID } from '../../support/engine/entity-ids';

// The ids of the three entities inside the aggregate (classes.md decisions 7, 19, 26 and 52):
// `BoardId` names the board of a match, `GameStateId` names the state of a match,
// and `LevelTimerId` names the timer of a timed match.
// Each id is local (issue #236): the factory builds it from the `MatchId` of the root.
// So each id keeps the `MatchId` of its match, and two ids are equal when their matches are equal.
// `MatchId` rejects an empty or blank text, so no id needs a check of its own.

const MATCH = MatchId.of('match-a');

// Matches that differ from `MATCH`: another text, another case, a trailing space.
const OTHER_MATCHES = [MatchId.of('match-b'), MatchId.of('MATCH-A'), MatchId.of('match-a ')];

describe('BoardId', () => {
  it('should_be_equal_in_both_directions_when_two_ids_keep_the_same_match', () => {
    const first = BoardId.of(MATCH);
    const second = BoardId.of(MatchId.of('match-a'));

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_keep_different_matches', () => {
    const first = BoardId.of(MATCH);

    for (const match of OTHER_MATCHES) {
      const other = BoardId.of(match);
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  it('should_reject_at_compile_time_when_a_caller_builds_the_id_from_a_text', () => {
    const builders = [
      // @ts-expect-error `BoardId.of()` takes the `MatchId` of the match, not a text.
      () => BoardId.of('board-a'),
    ];

    expect(builders).toHaveLength(1);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_match', () => {
    const readers = [
      // @ts-expect-error `BoardId.matchId` is private.
      () => BOARD_ID.matchId,
    ];

    expect(readers).toHaveLength(1);
  });
});

describe('GameStateId', () => {
  it('should_be_equal_in_both_directions_when_two_ids_keep_the_same_match', () => {
    const first = GameStateId.of(MATCH);
    const second = GameStateId.of(MatchId.of('match-a'));

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_keep_different_matches', () => {
    const first = GameStateId.of(MATCH);

    for (const match of OTHER_MATCHES) {
      const other = GameStateId.of(match);
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  it('should_reject_at_compile_time_when_a_caller_builds_the_id_from_a_text', () => {
    const builders = [
      // @ts-expect-error `GameStateId.of()` takes the `MatchId` of the match, not a text.
      () => GameStateId.of('state-a'),
    ];

    expect(builders).toHaveLength(1);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_match', () => {
    const readers = [
      // @ts-expect-error `GameStateId.matchId` is private.
      () => STATE_ID.matchId,
    ];

    expect(readers).toHaveLength(1);
  });
});

describe('LevelTimerId', () => {
  it('should_be_equal_in_both_directions_when_two_ids_keep_the_same_match', () => {
    const first = LevelTimerId.of(MATCH);
    const second = LevelTimerId.of(MatchId.of('match-a'));

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_keep_different_matches', () => {
    const first = LevelTimerId.of(MATCH);

    for (const match of OTHER_MATCHES) {
      const other = LevelTimerId.of(match);
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  it('should_reject_at_compile_time_when_a_caller_builds_the_id_from_a_text', () => {
    const builders = [
      // @ts-expect-error `LevelTimerId.of()` takes the `MatchId` of the match, not a text.
      () => LevelTimerId.of('timer-a'),
    ];

    expect(builders).toHaveLength(1);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_match', () => {
    const readers = [
      // @ts-expect-error `LevelTimerId.matchId` is private.
      () => TIMER_ID.matchId,
    ];

    expect(readers).toHaveLength(1);
  });
});
