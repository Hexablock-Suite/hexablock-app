import type { ValueReceiver } from '../shared/value-receiver';

// One count of the counters of the achievements (issue #363, part 3 of #277): the lines of one
// placement, the value of one tile or a count of goals. The engine names no variant, so the
// count says nothing of what it counts. The composition root and the listener of the edge
// give it its meaning.
// It is a value object: it never changes, and two counts are equal when their values are equal.
// A count is a safe integer of 0 or more. Any other number throws a RangeError.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private. `deliverTo()` gives the number to an adapter of the edge,
// and no operation returns it (rule R-no-delivery-call).
export class AchievementCount {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): AchievementCount {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `A count of an achievement needs a whole number of 0 or more, not ${value}.`,
      );
    }
    return new AchievementCount(value === 0 ? 0 : value);
  }

  // Two counts are equal when they hold the same value.
  equals(other: AchievementCount): boolean {
    return this.value === other.value;
  }

  // Tells if this count is equal to `other` or above it.
  isAtLeast(other: AchievementCount): boolean {
    return this.value >= other.value;
  }

  // The sum of this count and `other`. Neither count changes.
  // A sum above the largest safe integer is not exact, so it throws a RangeError.
  plus(other: AchievementCount): AchievementCount {
    return AchievementCount.of(this.value + other.value);
  }

  // Gives the number of this count to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }
}
