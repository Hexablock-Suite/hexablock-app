import type { IMergeable } from './mergeable';

// The cell of Hexa Merge: a value object that wraps an integer (assumption A1).
// A primitive integer cannot implement an interface, so the tile wraps it and implements
// `IMergeable`. A tile is 2 or 4 when it appears, and each merge doubles it (§1.4).
// So a value is a power of two of 2 or more. Any other number throws a RangeError.
export class MergeTile implements IMergeable<MergeTile> {
  private constructor(readonly value: number) {}

  static of(value: number): MergeTile {
    if (!Number.isSafeInteger(value) || value < 2 || !Number.isInteger(Math.log2(value))) {
      throw new RangeError(`A merge tile needs a power of two of 2 or more, not ${value}.`);
    }
    return new MergeTile(value);
  }

  // Two tiles are equal when they hold the same value.
  equals(other: MergeTile): boolean {
    return this.value === other.value;
  }

  canMergeWith(other: MergeTile): boolean {
    return this.value === other.value;
  }

  // Two equal tiles make one new tile of double value. Neither tile changes.
  mergeWith(other: MergeTile): MergeTile {
    if (!this.canMergeWith(other)) {
      throw new RangeError(`A tile of ${this.value} cannot merge with a tile of ${other.value}.`);
    }
    return MergeTile.of(this.value * 2);
  }

  // The points that a merge scores when it makes this tile: its value (issue #59, D22).
  points(): number {
    return this.value;
  }
}
