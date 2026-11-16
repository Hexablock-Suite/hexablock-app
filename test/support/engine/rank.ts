import type { Ordered } from '../../../src/domain/engine/ordered';

// A value object of the tests with a total order: a rank comes before every higher rank.
// The tests of `Range<T>` bind `T` to it, so they need no value object of a game (issue #239).
// Two ranks of the same position share a place in the order, but they are two objects.
export class Rank implements Ordered<Rank> {
  private constructor(private readonly position: number) {}

  static of(position: number): Rank {
    return new Rank(position);
  }

  isBefore(other: Rank): boolean {
    return this.position < other.position;
  }
}
