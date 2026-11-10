/** @jest-environment node */
import { Score } from '../../../src/domain/engine/score';
import { ScoringDecorator } from '../../../src/domain/engine/scoring-decorator';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';

// The abstract Decorator of the scoring (issue 146, classes.md patterns table, view engine-4).
// The state type exists only in this test, so the engine test imports no variant (APP-NFR-13).

// The photo of the state: a policy reads only photos (classes.md decision 34).
interface CounterPhoto {
  readonly points: number;
}

interface CounterState {
  snapshot(): CounterPhoto;
}

// A policy that gives the points of the photo after the turn and keeps each call it gets.
class RecordingScoring implements IScoringPolicy<CounterState> {
  readonly calls: [CounterPhoto, CounterPhoto][] = [];

  score(before: CounterPhoto, after: CounterPhoto): Score {
    this.calls.push([before, after]);
    return Score.of(after.points);
  }
}

// A decorator that adds no behavior: it keeps the score of the base class.
class PassThroughScoring extends ScoringDecorator<CounterState> {}

// A decorator that adds one bonus point to the inner score.
class BonusScoring extends ScoringDecorator<CounterState> {
  score(before: CounterPhoto, after: CounterPhoto): Score {
    return super.score(before, after).add(Score.of(1));
  }
}

const before: CounterPhoto = { points: 0 };
const after: CounterPhoto = { points: 7 };

describe('ScoringDecorator', () => {
  it('should_return_the_inner_score_unchanged_when_a_decorator_adds_no_behavior', () => {
    const inner = new RecordingScoring();
    const scoring: IScoringPolicy<CounterState> = new PassThroughScoring(inner);

    expect(scoring.score(before, after)).toEqual(Score.of(7));
    expect(inner.calls).toHaveLength(1);
    expect(inner.calls[0]?.[0]).toBe(before);
    expect(inner.calls[0]?.[1]).toBe(after);
  });

  it('should_reach_the_base_policy_when_a_decorator_wraps_another_decorator', () => {
    const inner = new RecordingScoring();
    const scoring = new BonusScoring(new PassThroughScoring(new BonusScoring(inner)));

    // 7 from the base policy, plus 1 from each bonus decorator.
    expect(scoring.score(before, after)).toEqual(Score.of(9));
    expect(inner.calls).toEqual([[before, after]]);
  });
});
