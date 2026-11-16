import type { MatchId } from './match-id';

// The id of one game state: the state of one match (classes.md decision 26).
// The state is an entity inside the `GameEngine` aggregate, so this id is its identity.
// The id is local: it has a meaning only inside the aggregate of its match (decision 52).
// `GameFactory` builds it from the `MatchId` of the root, so no generator gives it.
// The state also keeps the `MatchId` of its match, so it can tell which match it belongs to.
// It is a value object: it never changes. It keeps the `MatchId` of its match,
// and two ids are equal when their matches are equal. No operation gives the match away.
export class GameStateId {
  private constructor(private readonly matchId: MatchId) {}

  static of(matchId: MatchId): GameStateId {
    return new GameStateId(matchId);
  }

  equals(other: GameStateId): boolean {
    return this.matchId.equals(other.matchId);
  }
}
