import type { CoordKey } from './coord-key';

// The set of coordinates that a board covers. It is a value object: it never changes.
// `of()` copies the list and freezes the copy, so no caller can change the cells.
// A shape holds at least one coordinate. The shape has no topology, so it cannot compare
// two coordinates by itself. `Board` finds a repeated coordinate by its topology key,
// and `equals()` receives the topology.
// The list is private (classes.md decision 49). A reader asks the shape for its coordinates,
// for its first coordinate or for the keys that a topology gives them.
export class BoardShape<TCoord> {
  private constructor(private readonly cells: readonly TCoord[]) {}

  static of<TCoord>(cells: readonly TCoord[]): BoardShape<TCoord> {
    if (cells.length === 0) throw new RangeError('A board shape holds at least one coordinate.');
    return new BoardShape(Object.freeze([...cells]));
  }

  // Every coordinate of the shape, in the order of the shape.
  // Each call gives a new list, so a caller cannot change the shape through it.
  coordinates(): TCoord[] {
    return [...this.cells];
  }

  // The first coordinate of the shape. A shape holds one coordinate or more, so it always exists.
  first(): TCoord {
    return this.cells[0] as TCoord;
  }

  // The key that the topology gives to each coordinate, in the order of the shape.
  // A coordinate that the shape repeats gives its key once for each time.
  keys(topology: { key(c: TCoord): CoordKey }): CoordKey[] {
    return this.cells.map((c) => topology.key(c));
  }

  // Two shapes are equal when they cover the same coordinates. The order does not count.
  // A coordinate that a shape repeats counts once for each time.
  equals(other: BoardShape<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    const mine = this.keys(topology).sort();
    const theirs = other.keys(topology).sort();
    return mine.length === theirs.length && mine.every((key, i) => key === theirs[i]);
  }
}
