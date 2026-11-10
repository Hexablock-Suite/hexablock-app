import type { SnapshotOf } from './board-state';

// Strategy (statement §3.3): the domain service that computes the points of a turn.
// It keeps no game data (classes.md decision 26). Each variant scoring is open (decision #59).
// It reads two photos of the state (classes.md decision 34): `before` the move and `after`
// the rules resolved it. A photo is immutable, so the policy cannot change the game.
// `TState` names the state, and `SnapshotOf<TState>` gives the photo of that state.
export interface IScoringPolicy<TState> {
  score(before: SnapshotOf<TState>, after: SnapshotOf<TState>): number;
}
