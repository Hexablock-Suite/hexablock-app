// The id of one match: one game that a player starts and plays to its end.
// `GameId` says which game it is, and `MatchId` says which match of that game
// (classes.md decisions 26 and 30). Two matches of one game have the same `GameId`.
// It is a value object: it never changes. Two ids are equal when their values are equal.
// The value stays private. A `MatchIdGenerator` of an outer layer makes each id from a text.
// An empty id, or an id of only spaces, throws a RangeError.
export class MatchId {
  private constructor(private readonly value: string) {}

  static of(value: string): MatchId {
    if (value.trim() === '') throw new RangeError('A match id cannot be empty.');
    return new MatchId(value);
  }

  equals(other: MatchId): boolean {
    return this.value === other.value;
  }
}
