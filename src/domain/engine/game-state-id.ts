// The id of one game state: the state of one match (classes.md decision 26).
// The state is an entity inside the `GameEngine` aggregate, so this id is its identity.
// The state also keeps the `MatchId` of its match, so it can tell which match it belongs to.
// It is a value object: it never changes. Two ids are equal when their values are equal.
// The value stays private. A `GameStateIdGenerator` of an outer layer makes each id from a text.
// An empty id, or an id of only spaces, throws a RangeError.
export class GameStateId {
  private constructor(private readonly value: string) {}

  static of(value: string): GameStateId {
    if (value.trim() === '') throw new RangeError('A game state id cannot be empty.');
    return new GameStateId(value);
  }

  equals(other: GameStateId): boolean {
    return this.value === other.value;
  }
}
