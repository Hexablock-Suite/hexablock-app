/** @jest-environment node */
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
});
