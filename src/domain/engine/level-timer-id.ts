// The id of one level timer: the timer of one timed game (classes.md decision 19).
// The timer is an entity inside the aggregate, so this id is its identity.
// It is a value object: it never changes. Two ids are equal when their values are equal.
// The value stays private. A `LevelTimerIdGenerator` of an outer layer makes each id from a text.
// An empty id, or an id of only spaces, throws a RangeError.
export class LevelTimerId {
  private constructor(private readonly value: string) {}

  static of(value: string): LevelTimerId {
    if (value.trim() === '') throw new RangeError('A level timer id cannot be empty.');
    return new LevelTimerId(value);
  }

  equals(other: LevelTimerId): boolean {
    return this.value === other.value;
  }
}
