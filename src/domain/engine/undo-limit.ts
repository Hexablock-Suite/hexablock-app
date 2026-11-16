// The count of moves that a history keeps for undo: a whole number of one or more
// (classes.md decision 3, issue #243). Merge keeps one move: `UndoLimit.of(1)`.
// It is a value object: it never changes, and two limits are equal when their counts are equal.
// `of()` is the only place that checks the count. The count stays private.
// A history keeps its newest commands with `newestOf()`.
export class UndoLimit {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): UndoLimit {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`An undo limit needs a whole number of one or more, not ${value}.`);
    }
    return new UndoLimit(value);
  }

  // Two limits are equal when they hold the same count.
  equals(other: UndoLimit): boolean {
    return this.value === other.value;
  }

  // The newest items of `items` that the limit keeps: the last ones, in their order.
  // A list within the limit comes back whole. The given list does not change.
  newestOf<T>(items: readonly T[]): T[] {
    return items.slice(-this.value);
  }
}
