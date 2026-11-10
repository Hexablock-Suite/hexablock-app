import { Range } from '../../engine/range';

// The chances that a probability can take: from 0 to 1, both included.
const CHANCES = Range.ofNumbers(0, 1);

// The chance that a new Merge tile is a 4 (statement §1.4, issue #210).
// It is a value object: it never changes, and two chances are equal when their values are equal.
// A chance is a number from 0 to 1. Any other number throws a RangeError.
// Only Hexa Merge has a chance, so the class lives in this folder and not in the engine.
// The number stays private: `hits()` compares a draw with it.
export class Chance {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Chance {
    if (!CHANCES.contains(value)) {
      throw new RangeError(`The chance of a 4 must be a number from 0 to 1, not ${value}.`);
    }
    return new Chance(value === 0 ? 0 : value);
  }

  // Two chances are equal when they hold the same value.
  equals(other: Chance): boolean {
    return this.value === other.value;
  }

  // Tells if a draw hits. A draw is a number from 0 up to 1, as a random source gives it.
  // It hits when it is below the chance. So a chance of 0 never hits, and a chance of 1 always hits.
  hits(draw: number): boolean {
    return draw < this.value;
  }
}
