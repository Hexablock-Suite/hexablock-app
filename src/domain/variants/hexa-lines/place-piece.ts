import type { CoordKey } from '../../engine/geometry/coord-key';
import type { ReadonlyBoard } from '../../engine/board/board';
import type { Piece } from '../../engine/board/piece';
import type { TrayPosition } from './tray-position';

// The Hexa Lines move: put the tray piece at `position` on the board.
// It is a value object (classes.md decision 43): it never changes, its fields are private,
// and two moves are equal when they hold the same tray position and the same offset.
// `at` is the offset that the topology adds to each cell of the piece shape
// (`Piece.translated()`). A piece shape holds its cells around the origin of the topology.
// The tray position is a `TrayPosition` (issue #232). It checks its own index,
// so the rules and the state never check the index again.
// The move does not know the tray or the board. The state asks the move for its tray piece
// and for the cells that the piece covers.
export class PlacePiece<TCoord> {
  constructor(
    private readonly position: TrayPosition,
    private readonly at: TCoord,
  ) {}

  // The tray piece that this move names, or `undefined` when the tray has no piece at its position.
  pieceIn<TPiece>(tray: readonly TPiece[]): TPiece | undefined {
    return this.position.pieceIn(tray);
  }

  // The tray without the piece that this move names. The tray does not change.
  trayWithout<TPiece>(tray: readonly TPiece[]): TPiece[] {
    return this.position.trayWithout(tray);
  }

  // The cells that the piece covers when the board moves it by the offset of this move.
  // The board does not cut the piece, so a cell can lie outside the board.
  cells<TCell>(piece: Piece<TCell, TCoord>, board: ReadonlyBoard<TCell, TCoord>): TCoord[] {
    return board.moved(piece, this.at).coveredCoordinates();
  }

  // The error of a tray that has no piece at the position of this move.
  missingPiece(): RangeError {
    return this.position.missingPiece();
  }

  // The error of a tray piece that does not fit at the offset of this move.
  misfit(topology: { key(c: TCoord): CoordKey }): RangeError {
    return this.position.misfitAt(topology.key(this.at));
  }

  // Two moves are equal when they have the same tray position and the same offset.
  // The topology compares the offsets, because `TCoord` has no bound (classes.md decision 16).
  equals(other: PlacePiece<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return (
      this.position.equals(other.position) && topology.key(this.at).equals(topology.key(other.at))
    );
  }
}
