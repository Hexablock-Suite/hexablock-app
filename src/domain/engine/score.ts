import type { ValueReceiver } from './value-receiver';

// The score of a game, and the points of one turn (classes.md decision 41, issue #203).
// It is a value object: it never changes, and two scores are equal when their values are equal.
// A score is a safe integer of 0 or more. It is the rule of the backend `Score`,
// so the app never keeps a score that the backend refuses.
// Any other number throws a RangeError. A negative zero is stored as 0.
// Each operation returns a new `Score`. The object is frozen, so no caller writes the value.
// The value is private (issue #228). `deliverTo()` gives the number to a receiver,
// and no operation returns it. Only an adapter of the edge calls `deliverTo()`:
// the domain and the use cases call the operations.
// A score has no product with a number (issue #232). A count of the game gives its own points,
// as `MergeTile.points()` and the Lines counts do, so no factor crosses a public signature.
export class Score {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Score {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`A score needs a whole number of 0 or more, not ${value}.`);
    }
    return new Score(value === 0 ? 0 : value);
  }

  // Two scores are equal when they hold the same value.
  equals(other: Score): boolean {
    return this.value === other.value;
  }

  // Gives the number of this score to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }

  // The sum of two scores. Neither score changes.
  // A sum above the largest safe integer is not exact, so it throws a RangeError.
  add(points: Score): Score {
    const sum = this.value + points.value;
    if (sum > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('The sum of two scores cannot pass the largest safe integer.');
    }
    return new Score(sum);
  }

  // Tells if this score is higher than `other`. An equal score is not higher.
  isHigherThan(other: Score): boolean {
    return this.value > other.value;
  }
}
