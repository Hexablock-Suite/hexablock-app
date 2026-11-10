import type { CoordKey } from '../../engine/coord-key';
import type { GridTopology } from '../../engine/grid-topology';
import type { Piece } from '../../engine/piece';

// The Hexa Lines move: put the tray piece at `trayIndex` on the board.
// It is a value object (classes.md decision 43): it never changes, its fields are private,
// and two moves are equal when they hold the same tray index and the same offset.
// `at` is the offset that the topology adds to each cell of the piece shape
// (`Piece.translated()`). A piece shape holds its cells around the origin of the topology.
// A tray index is a whole number of 0 or more. Any other number throws a RangeError,
// so the rules and the state never check the index again.
// The move does not know the tray or the board. The state asks the move for its tray piece
// and for the cells that the piece covers.
export class PlacePiece<TCoord> {
  constructor(
    private readonly trayIndex: number,
    private readonly at: TCoord,
  ) {
    if (!Number.isSafeInteger(trayIndex) || trayIndex < 0) {
      throw new RangeError(`A tray index needs a whole number of 0 or more, not ${trayIndex}.`);
    }
  }

  // The tray piece that this move names, or `undefined` when the tray has no piece at its index.
  pieceIn<TPiece>(tray: readonly TPiece[]): TPiece | undefined {
    return tray[this.trayIndex];
  }

  // The tray without the piece that this move names. The tray does not change.
  trayWithout<TPiece>(tray: readonly TPiece[]): TPiece[] {
    return tray.filter((_, index) => index !== this.trayIndex);
  }

  // The board cells that the piece covers when the topology moves it by the offset of this move.
  cells<TCell>(
    piece: Piece<TCell, TCoord>,
    topology: GridTopology<TCoord, string, string>,
  ): TCoord[] {
    return piece.translated(this.at, topology).shape.cells();
  }

  // The error of a tray that has no piece at the index of this move.
  missingPiece(): RangeError {
    return new RangeError(`The tray has no piece at index ${this.trayIndex}.`);
  }

  // The error of a tray piece that does not fit at the offset of this move.
  misfit(topology: { key(c: TCoord): CoordKey }): RangeError {
    return new RangeError(
      `The piece at tray index ${this.trayIndex} does not fit at ${topology.key(this.at)}.`,
    );
  }

  // Two moves are equal when they have the same tray index and the same offset.
  // The topology compares the offsets, because `TCoord` has no bound (classes.md decision 16).
  equals(other: PlacePiece<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return this.trayIndex === other.trayIndex && topology.key(this.at) === topology.key(other.at);
  }
}
