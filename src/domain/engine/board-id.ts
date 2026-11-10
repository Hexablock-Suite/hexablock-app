// The id of one board: the board of one state of a game (classes.md decision 7).
// The board is an entity inside the state, so this id is its identity.
// It is a value object: it never changes. Two ids are equal when their values are equal.
// The value stays private. A `BoardIdGenerator` of an outer layer makes each id from a text.
// An empty id, or an id of only spaces, throws a RangeError.
export class BoardId {
  private constructor(private readonly value: string) {}

  static of(value: string): BoardId {
    if (value.trim() === '') throw new RangeError('A board id cannot be empty.');
    return new BoardId(value);
  }

  equals(other: BoardId): boolean {
    return this.value === other.value;
  }
}
