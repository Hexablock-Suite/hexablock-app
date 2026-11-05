import type { Resolution } from './resolution';

// Strategy (statement §3.3): the domain service that computes the points of a turn.
// It keeps no game data (classes.md decision 26). Each variant scoring is open (decision #59).
export interface IScoringPolicy<TState> {
  score(before: TState, resolution: Resolution<TState>): number;
}
