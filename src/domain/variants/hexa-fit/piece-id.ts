// The cell content of Hexa Fit: the id of the piece that covers the cell (REQUIREMENTS.md §1).
// It is a value object: it never changes. Two ids are equal when their values are equal.
// The value stays a string, because a level file names each piece with a text id.
// An empty id, or an id of only spaces, throws a RangeError.
export class PieceId {
  private constructor(readonly value: string) {}

  static of(value: string): PieceId {
    if (value.trim() === '') throw new RangeError('A piece id cannot be empty.');
    return new PieceId(value);
  }

  equals(other: PieceId): boolean {
    return this.value === other.value;
  }
}
