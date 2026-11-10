/** @jest-environment node */
import { fitFactory } from '../../../support/variants/hexa-fit/fit-game';

// R7: the Fit state is an entity. The engine adds the points of a turn through `addPoints()`.

describe('FitState', () => {
  it('should_add_the_points_and_refuse_points_that_are_not_finite_when_points_are_added', () => {
    const state = fitFactory().createInitialState();

    state.addPoints(3);
    state.addPoints(-1);

    expect(state.score).toBe(2);
    expect(() => state.addPoints(Number.POSITIVE_INFINITY)).toThrow(
      new RangeError('The points of a turn must be a finite number, not Infinity.'),
    );
    expect(state.score).toBe(2);
  });
});
