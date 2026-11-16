import type { MatchId } from './match-id';

// The id of one board: the board of the state of one match (classes.md decision 7).
// The board is an entity inside the state, so this id is its identity.
// The id is local: it has a meaning only inside the aggregate of its match (decision 52).
// `GameFactory` builds it from the `MatchId` of the root, so no generator gives it.
// It is a value object: it never changes. It keeps the `MatchId` of its match,
// and two ids are equal when their matches are equal. No operation gives the match away.
export class BoardId {
  private constructor(private readonly matchId: MatchId) {}

  static of(matchId: MatchId): BoardId {
    return new BoardId(matchId);
  }

  equals(other: BoardId): boolean {
    return this.matchId.equals(other.matchId);
  }
}
