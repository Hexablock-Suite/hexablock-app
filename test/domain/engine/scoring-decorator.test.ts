/** @jest-environment node */
import { Resolution } from '../../../src/domain/engine/resolution';
import { ScoringDecorator } from '../../../src/domain/engine/scoring-decorator';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';

// The abstract Decorator of the scoring (issue 146, classes.md patterns table, view engine-4).
// The state type exists only in this test, so the engine test imports no variant (APP-NFR-13).

interface CounterState {
  readonly points: number;
}

// A policy that gives the points of the new state and keeps each call it gets.
class RecordingScoring implements IScoringPolicy<CounterState> {
  readonly calls: [CounterState, Resolution<CounterState>][] = [];

  score(before: CounterState, resolution: Resolution<CounterState>): number {
    this.calls.push([before, resolution]);
    return resolution.state.points;
  }
}

// A decorator that adds no behavior: it keeps the score of the base class.
class PassThroughScoring extends ScoringDecorator<CounterState> {}

// A decorator that adds one bonus point to the inner score.
class BonusScoring extends ScoringDecorator<CounterState> {
  score(before: CounterState, resolution: Resolution<CounterState>): number {
    return super.score(before, resolution) + 1;
  }
}

const before: CounterState = { points: 0 };
const resolution = Resolution.resolved<CounterState>({ points: 7 });

describe('ScoringDecorator', () => {
  it('should_return_the_inner_score_unchanged_when_a_decorator_adds_no_behavior', () => {
    const inner = new RecordingScoring();
    const scoring: IScoringPolicy<CounterState> = new PassThroughScoring(inner);

    expect(scoring.score(before, resolution)).toBe(7);
    expect(inner.calls).toHaveLength(1);
    expect(inner.calls[0]?.[0]).toBe(before);
    expect(inner.calls[0]?.[1]).toBe(resolution);
  });

  it('should_reach_the_base_policy_when_a_decorator_wraps_another_decorator', () => {
    const inner = new RecordingScoring();
    const scoring = new BonusScoring(new PassThroughScoring(new BonusScoring(inner)));

    // 7 from the base policy, plus 1 from each bonus decorator.
    expect(scoring.score(before, resolution)).toBe(9);
    expect(inner.calls).toEqual([[before, resolution]]);
  });
});
