// The Hexa Lines move: put the tray piece at `trayIndex` on the board. It is a value object.
// `at` is the offset that the topology adds to each cell of the piece shape
// (`Piece.translated()`). A piece shape holds its cells around the origin of the topology.
export class PlacePiece<TCoord> {
  constructor(
    readonly trayIndex: number,
    readonly at: TCoord,
  ) {}
}
