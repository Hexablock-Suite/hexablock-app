// The id of one level of a game, such as `fit-01` (classes.md decision 42, issue #204).
// The level file gives it. A game with no levels has no level id.
// It is a value object: it never changes, and two ids are equal when their texts are equal.
// The id keeps its text as it arrives, as the backend `LevelId` does (hexablock-api#88).
// An empty id, or an id of only spaces, throws a RangeError.
// The object is frozen, so no caller writes the value.
// `value` stays readable, as in the backend `LevelId`. The name of the operation that gives
// the text to an adapter is an open question (README table «Primitive types»).
// Only an adapter of the edge reads `value`: the domain and the use cases call `equals()`.
export class LevelId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static of(value: string): LevelId {
    if (value.trim() === '') throw new RangeError('A level id cannot be empty.');
    return new LevelId(value);
  }

  // Two level ids are equal when they hold the same text.
  equals(other: LevelId): boolean {
    return this.value === other.value;
  }
}
