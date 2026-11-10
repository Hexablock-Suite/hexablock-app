import type { CoordKey } from './coord-key';

// The set of coordinates that a board covers. It is a value object: it never changes.
// `of()` copies the list and freezes the copy, so no caller can change the cells.
// A shape holds at least one coordinate. The shape has no topology, so it cannot compare
// two coordinates by itself. `Board` finds a repeated coordinate by its topology key,
// and `equals()` receives the topology.
export class BoardShape<TCoord> {
  private constructor(readonly cells: readonly TCoord[]) {}

  static of<TCoord>(cells: readonly TCoord[]): BoardShape<TCoord> {
    if (cells.length === 0) throw new RangeError('A board shape holds at least one coordinate.');
    return new BoardShape(Object.freeze([...cells]));
  }

  // Two shapes are equal when they cover the same coordinates. The order does not count.
  // A coordinate that a shape repeats counts once for each time.
  equals(other: BoardShape<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    const keysOf = (shape: BoardShape<TCoord>): CoordKey[] =>
      shape.cells.map((c) => topology.key(c)).sort();
    const mine = keysOf(this);
    const theirs = keysOf(other);
    return mine.length === theirs.length && mine.every((key, i) => key === theirs[i]);
  }
}
