import type { CoordKey } from '../../engine/coord-key';

// The place of one piece in the Hexa Lines tray, from 0 (issue #232).
// A `PlacePiece` names its tray piece with it (classes.md decision 43).
// It is a value object: it never changes, and two positions are equal when their indexes are equal.
// A tray index is a safe integer of 0 or more. Any other number throws a RangeError,
// so the rules and the state never check the index again. A negative zero is stored as 0.
// The object is frozen, so no caller writes the index.
// The index is private, and no operation returns it. The position finds its piece in a tray,
// and it builds the errors that name its index.
export class TrayPosition {
  private constructor(private readonly index: number) {
    Object.freeze(this);
  }

  static of(index: number): TrayPosition {
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new RangeError(`A tray index needs a whole number of 0 or more, not ${index}.`);
    }
    return new TrayPosition(index === 0 ? 0 : index);
  }

  // Two positions are equal when they hold the same index.
  equals(other: TrayPosition): boolean {
    return this.index === other.index;
  }

  // The tray piece at this position, or `undefined` when the tray has no piece there.
  pieceIn<TPiece>(tray: readonly TPiece[]): TPiece | undefined {
    return tray[this.index];
  }

  // The tray without the piece at this position. The tray does not change.
  trayWithout<TPiece>(tray: readonly TPiece[]): TPiece[] {
    return tray.filter((_, index) => index !== this.index);
  }

  // The error of a tray that has no piece at this position.
  missingPiece(): RangeError {
    return new RangeError(`The tray has no piece at index ${this.index}.`);
  }

  // The error of a tray piece at this position that does not fit at the cell of the key `at`.
  misfitAt(at: CoordKey): RangeError {
    return new RangeError(`The piece at tray index ${this.index} does not fit at ${at}.`);
  }
}
