// The set of coordinates that a board covers. It is a value object: it never changes.
// A shape holds at least one coordinate. The shape has no topology, so it cannot compare
// two coordinates. `Board` finds a repeated coordinate by its topology key.
export class BoardShape<TCoord> {
  private constructor(readonly cells: readonly TCoord[]) {}

  static of<TCoord>(cells: readonly TCoord[]): BoardShape<TCoord> {
    if (cells.length === 0) throw new RangeError('A board shape holds at least one coordinate.');
    return new BoardShape([...cells]);
  }
}
