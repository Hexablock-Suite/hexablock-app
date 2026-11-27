import { Seed } from './seed';
import type { ValueReceiver } from './value-receiver';

// The count of seeds: the unsigned 32-bit integers (classes.md decision 48).
const SEEDS = 4294967296;

// One draw of a random source: a number from 0 up to 1, without 1 (APP-NFR-07, issue #243).
// It is a value object: it never changes, and two draws are equal when their numbers are equal.
// `of()` is the only place that checks the number. A negative zero is stored as 0.
// The number stays private. A caller picks an item with `pick()` and compares with `equals()`
// and `isBelow()`. Only an adapter of the edge receives the number (rule R-no-delivery-call).
// It is the one type of a draw: Hexa Merge takes it too, for the cell and the value of a new
// tile (issue #243, which replaced the Merge `Draw` of issue #232).
export class RandomDraw {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): RandomDraw {
    if (!(value >= 0 && value < 1)) {
      throw new RangeError(`A random draw must be a number from 0 up to 1, not ${value}.`);
    }
    return new RandomDraw(value === 0 ? 0 : value);
  }

  // Two draws are equal when they hold the same number.
  equals(other: RandomDraw): boolean {
    return this.value === other.value;
  }

  // Tells if this draw falls below the other draw. An equal draw does not fall below.
  // The chance of a 4 of Hexa Merge hits when the draw falls below it.
  isBelow(other: RandomDraw): boolean {
    return this.value < other.value;
  }

  // The item at the place of this draw in `items`: the draw times the count, rounded down.
  // So the order of the list counts. A list with no item throws a RangeError.
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('A draw needs one item or more to pick from.');
    return items[Math.min(Math.floor(this.value * items.length), items.length - 1)] as T;
  }

  // The seed that this draw picks: the draw times the count of seeds, rounded down (issue #417).
  // So the draw 0 picks the seed 0, and the largest draw picks the seed 4294967295.
  // A variant factory draws the seed of each new match with it, so no number leaves the draw.
  pickSeed(): Seed {
    return Seed.of(Math.floor(this.value * SEEDS));
  }

  // Gives the number of the draw to `receiver`. It returns nothing.
  // Only an adapter of the edge receives the number.
  // No code of the domain or of the use cases calls it (rule R-no-delivery-call).
  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }
}
