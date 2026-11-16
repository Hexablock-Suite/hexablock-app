import { Chance } from './chance';

// One draw of the Merge tile source: a number from 0 up to 1, with 1 left out,
// as a random source gives it (statement §1.4, issue #232).
// `mergeTileSource()` reads two draws for each new tile. The first draw picks the empty cell,
// and the second draw falls below the chance of a 4 or not.
// It is a value object: it never changes, and two draws are equal when their values are equal.
// Any number that is not from 0 up to 1 throws a RangeError. NaN is no draw.
// A negative zero is stored as 0. The object is frozen, so no caller writes the value.
// The value is private, and no operation returns it.
export class Draw {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Draw {
    if (Number.isNaN(value) || value < 0 || value >= 1) {
      throw new RangeError(`A draw must be a number from 0 up to 1, not ${value}.`);
    }
    return new Draw(value === 0 ? 0 : value);
  }

  // Two draws are equal when they hold the same value.
  equals(other: Draw): boolean {
    return this.value === other.value;
  }

  // The item that this draw picks by its position in `items`, so the order of the list counts.
  // A draw of 0 picks the first item, and a draw near 1 picks the last item.
  // A list with no item throws a RangeError, because the draw has nothing to pick.
  pick<TItem>(items: readonly TItem[]): TItem {
    if (items.length === 0) throw new RangeError('A draw needs one item or more to pick from.');
    return items[Math.floor(this.value * items.length)] as TItem;
  }

  // Tells if this draw falls below `chance`. A draw is a number from 0 up to 1,
  // so it is also a chance, and `Chance` compares the two chances.
  isBelow(chance: Chance): boolean {
    return chance.isAbove(Chance.of(this.value));
  }
}
