// The score of a game, and the points of one turn (classes.md decision 41, issue #203).
// It is a value object: it never changes, and two scores are equal when their values are equal.
// A score is a safe integer of 0 or more. It is the rule of the backend `Score`,
// so the app never keeps a score that the backend refuses.
// Any other number throws a RangeError. A negative zero is stored as 0.
// Each operation returns a new `Score`. The object is frozen, so no caller writes the value.
// `value` stays readable, as in the backend `Score`. The name of the operation that gives
// the number to an adapter is an open question (README table «Primitive types»).
// Only an adapter of the edge reads `value`: the domain and the use cases call the operations.
export class Score {
  private constructor(readonly value: number) {
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

  // The sum of two scores. Neither score changes.
  // A sum above the largest safe integer is not exact, so it throws a RangeError.
  add(points: Score): Score {
    const sum = this.value + points.value;
    if (sum > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('The sum of two scores cannot pass the largest safe integer.');
    }
    return new Score(sum);
  }

  // The product of this score and a whole factor, as a combo multiplier needs it.
  // The factor is a safe integer of 0 or more. Any other factor throws a RangeError.
  // A product above the largest safe integer is not exact, so it throws a RangeError.
  times(factor: number): Score {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      throw new RangeError(`A score factor needs a whole number of 0 or more, not ${factor}.`);
    }
    const product = this.value * factor;
    if (product > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('The product of a score cannot pass the largest safe integer.');
    }
    return new Score(product === 0 ? 0 : product);
  }

  // Tells if this score is higher than `other`. An equal score is not higher.
  isHigherThan(other: Score): boolean {
    return this.value > other.value;
  }
}
