/** @jest-environment node */
import { fitFactory, threeDominoFitFactory } from '../../../support/variants/hexa-fit/fit-game';
import { firstValidMove } from '../../../support/engine/variant-game';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { MATCH_ID } from '../../../support/engine/match-id';

// R7: the Fit state is an entity. The engine adds the points of a turn through `addPoints()`.

describe('FitState', () => {
  it('should_add_the_points_and_refuse_points_that_are_not_finite_when_points_are_added', () => {
    const state = fitFactory().createInitialState(MATCH_ID);

    state.addPoints(3);
    state.addPoints(-1);

    expect(state.score).toBe(2);
    expect(() => state.addPoints(Number.POSITIVE_INFINITY)).toThrow(
      new RangeError('The points of a turn must be a finite number, not Infinity.'),
    );
    expect(state.score).toBe(2);
  });

  // The identity of the state is the identity of its match (classes.md decision 26).
  // A move gives a new object of the same state, so it keeps the identity.
  it('should_be_the_same_state_when_two_states_belong_to_one_match_whatever_they_hold', () => {
    const factory = fitFactory();
    const rules = factory.createRules();
    const first = factory.createInitialState(MatchId.of('m-a'));
    const moved = rules.apply(first, firstValidMove(rules, first));
    const other = threeDominoFitFactory().createInitialState(MatchId.of('m-b'));

    expect([first.equals(moved), moved.equals(first), first.equals(first.clone())]).toEqual([
      true,
      true,
      true,
    ]);
    expect([first.equals(other), other.equals(first)]).toEqual([false, false]);
    expect([moved.belongsTo(MatchId.of('m-a')), moved.belongsTo(MatchId.of('m-b'))]).toEqual([
      true,
      false,
    ]);
  });
});
