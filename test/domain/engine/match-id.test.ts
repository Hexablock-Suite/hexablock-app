/** @jest-environment node */
import { MatchId } from '../../../src/domain/engine/match-id';
import { CountingMatchIds, MATCH_ID } from '../../support/engine/match-id';

// The id of one match (classes.md decision 30): `GameId` says which game it is,
// and `MatchId` says which match of that game.

describe('MatchId', () => {
  it('should_throw_a_range_error_when_the_value_is_empty_or_blank', () => {
    for (const value of ['', ' ', '\t\n']) {
      expect(() => MatchId.of(value)).toThrow(RangeError);
      expect(() => MatchId.of(value)).toThrow('A match id cannot be empty.');
    }
  });

  it('should_be_equal_in_both_directions_when_two_ids_hold_the_same_value', () => {
    const first = MatchId.of('match-a');
    const second = MatchId.of('match-a');

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_hold_different_values', () => {
    const first = MatchId.of('match-a');

    for (const other of [MatchId.of('match-b'), MatchId.of('MATCH-A'), MatchId.of('match-a ')]) {
      expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    }
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `MatchId.value` is private.
      () => MATCH_ID.value,
    ];

    expect(readers).toHaveLength(1);
  });
});

// The generator is an engine interface, as `Clock` is. Layer 4 implements it.
// This suite pins the test double that the other suites inject.
describe('CountingMatchIds', () => {
  it('should_give_a_new_match_id_when_the_generator_is_asked_again', () => {
    const ids = new CountingMatchIds();

    const first = ids.next();
    const second = ids.next();

    expect(first.equals(MatchId.of('match-1'))).toBe(true);
    expect(second.equals(MatchId.of('match-2'))).toBe(true);
    expect(first.equals(second)).toBe(false);
  });

  it('should_give_the_same_ids_when_two_generators_start', () => {
    expect(new CountingMatchIds().next().equals(new CountingMatchIds().next())).toBe(true);
  });
});
