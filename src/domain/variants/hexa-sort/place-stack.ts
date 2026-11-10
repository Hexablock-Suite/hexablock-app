import type { CoordKey } from '../../engine/coord-key';

// The move of Hexa Sort: place the offered stack on the cell `at` (statement §1.3).
// It is a value object (classes.md decision 43): it never changes, its field is private,
// and two moves are equal when they name the same cell.
// A move does not know the board, so the state checks that the cell is inside it and free.
export class PlaceStack<TCoord> {
  private constructor(private readonly at: TCoord) {}

  static on<TCoord>(at: TCoord): PlaceStack<TCoord> {
    return new PlaceStack(at);
  }

  // The cell that takes the offered stack.
  cell(): TCoord {
    return this.at;
  }

  // Two moves are equal when they name the same cell.
  // The topology compares the cells, because `TCoord` has no bound (classes.md decision 16).
  equals(other: PlaceStack<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return topology.key(this.at) === topology.key(other.at);
  }
}
