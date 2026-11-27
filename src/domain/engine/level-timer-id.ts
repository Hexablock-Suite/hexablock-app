import type { MatchId } from './match-id';

// The id of one level timer: the timer of one timed match (classes.md decisions 19 and 50).
// The timer is an entity inside the aggregate, so this id is its identity.
// The id is local: it has a meaning only inside the aggregate of its match (decision 52).
// A timed variant factory builds it from the `MatchId` in `createTimer(matchId)`,
// so no generator gives it.
// It is a value object: it never changes. It keeps the `MatchId` of its match,
// and two ids are equal when their matches are equal. No operation gives the match away.
export class LevelTimerId {
  private constructor(private readonly matchId: MatchId) {}

  static of(matchId: MatchId): LevelTimerId {
    return new LevelTimerId(matchId);
  }

  equals(other: LevelTimerId): boolean {
    return this.matchId.equals(other.matchId);
  }
}
