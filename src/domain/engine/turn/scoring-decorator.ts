import type { SnapshotOf } from '../board/board-state';
import type { Score } from '../../shared/score';
import type { IScoringPolicy } from './scoring-policy';

// The abstract Decorator of the scoring (classes.md patterns table, view engine-4, issue 146).
// It implements `IScoringPolicy` and keeps the inner policy it wraps.
// Each bonus extends it and changes the inner score in `score()`.
// `inner` is private, as every attribute of the domain (issue #231). A bonus reads no field
// of this class: it calls `super.score()` for the inner score.
// `TInner` binds the type of the inner policy. A bonus that reads a member of its base
// policy binds that type, keeps its own private reference of it and passes it to `super()`.
// A bonus that reads no member keeps the default `IScoringPolicy<TState>`, as
// `ComboMultiplierDecorator` does (issue #427, view variant-1-lines).
export abstract class ScoringDecorator<
  TState,
  TInner extends IScoringPolicy<TState> = IScoringPolicy<TState>,
> implements IScoringPolicy<TState> {
  constructor(private readonly inner: TInner) {}

  // A bonus overrides it and calls `super.score()` to get the inner score.
  // This base returns the inner score unchanged.
  score(before: SnapshotOf<TState>, after: SnapshotOf<TState>): Score {
    return this.inner.score(before, after);
  }
}
