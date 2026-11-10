// The count of stacks that one Hexa Sort game cleared (classes.md decision 42, issue #204).
// Each cleared stack counts one goal, and `GoalCount.isReachedBy()` reads the count.
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A count of cleared stacks is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0.
// Each operation returns a new `ClearedStacks`. The object is frozen, so no caller writes the value.
// `value` stays readable, because the Sort screen shows it. The name of the operation that gives
// the number to an adapter is an open question (README table «Primitive types»).
// Only an adapter of the edge reads `value`: the domain and the use cases call the operations.
export class ClearedStacks {
  private constructor(readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): ClearedStacks {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `A count of cleared stacks needs a whole number of 0 or more, not ${value}.`,
      );
    }
    return new ClearedStacks(value === 0 ? 0 : value);
  }

  // Two counts are equal when they hold the same value.
  equals(other: ClearedStacks): boolean {
    return this.value === other.value;
  }

  // The count after one more cleared stack. This count does not change.
  // A count above the largest safe integer is not exact, so it throws a RangeError.
  plusOne(): ClearedStacks {
    return ClearedStacks.of(this.value + 1);
  }

  // Tells if this count is `other` or more.
  isAtLeast(other: ClearedStacks): boolean {
    return this.value >= other.value;
  }
}
