// The set of coordinates that a board covers. It is a value object: it never changes.
export class BoardShape<TCoord> {
  private constructor(readonly cells: readonly TCoord[]) {}

  static of<TCoord>(cells: readonly TCoord[]): BoardShape<TCoord> {
    return new BoardShape([...cells]);
  }
}
