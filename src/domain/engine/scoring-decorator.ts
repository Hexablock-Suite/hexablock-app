import type { SnapshotOf } from './board-state';
import type { IScoringPolicy } from './scoring-policy';

// The abstract Decorator of the scoring (classes.md patterns table, view engine-4, issue 146).
// It implements `IScoringPolicy` and keeps the inner policy it wraps.
// Each bonus extends it and changes the inner score in `score()`.
// `TInner` binds the type of the inner policy. A bonus can then read the members
// of its own base policy, as view variant-1-lines draws for `ComboMultiplierDecorator`.
export abstract class ScoringDecorator<
  TState,
  TInner extends IScoringPolicy<TState> = IScoringPolicy<TState>,
> implements IScoringPolicy<TState> {
  constructor(protected readonly inner: TInner) {}

  // A bonus overrides it and calls `super.score()` to get the inner score.
  // This base returns the inner score unchanged.
  score(before: SnapshotOf<TState>, after: SnapshotOf<TState>): number {
    return this.inner.score(before, after);
  }
}
