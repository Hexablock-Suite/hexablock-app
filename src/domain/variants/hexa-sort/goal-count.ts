import type { ValueReceiver } from '../../shared/value-receiver';
import { ClearedStacks } from './cleared-stacks';

// The goal of one Hexa Sort level: the count of stacks that the player must clear to win.
// It is a value object: it never changes (issue #129, gaps G108.1 and G116.5).
// A goal of 0 wins before the first move, and NaN never wins, so `of()` rejects both.
// Any number that is not a safe integer of 1 or more throws a RangeError.
// No source names an upper bound, so the largest safe integer is the largest goal
// (decision on issue #129). `of()` checks the number itself (issue #239).
export class GoalCount {
  private constructor(private readonly value: number) {}

  static of(value: number): GoalCount {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`A goal count needs a whole number of 1 or more, not ${value}.`);
    }
    return new GoalCount(value);
  }

  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }

  // Two goal counts are equal when they hold the same value.
  equals(other: GoalCount): boolean {
    return this.value === other.value;
  }

  // Tells if a count of cleared stacks reaches the goal. A count above the goal reaches it too.
  // The goal is itself a count of stacks, so `ClearedStacks` compares the two counts.
  isReachedBy(goalsDone: ClearedStacks): boolean {
    return goalsDone.isAtLeast(ClearedStacks.of(this.value));
  }
}
