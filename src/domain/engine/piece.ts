import { BoardShape } from './board-shape';
import type { Cloneable } from './cloneable';
import type { CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { ShapeNode } from './shape-node';
import type { Turns } from './turns';

// One piece type for the four variants: a shape plus the content it puts on the board
// (classes.md decision 6). A piece never changes: each operation returns a new piece.
// The shape and the content are private (classes.md decision 49).
// A reader asks the piece for the coordinates that it covers and for the cell that it puts.
export class Piece<TCell, TCoord> implements Cloneable<Piece<TCell, TCoord>> {
  constructor(
    private readonly shape: ShapeNode<TCoord>,
    private readonly content: TCell,
  ) {}

  rotated(turns: Turns, topology: GridTopology<TCoord>): Piece<TCell, TCoord> {
    return new Piece(this.shape.rotated(turns, topology), this.content);
  }

  translated(offset: TCoord, topology: GridTopology<TCoord>): Piece<TCell, TCoord> {
    return new Piece(this.shape.translated(offset, topology), this.content);
  }

  // The coordinates that the piece covers, in the order of its shape. Each call gives a new list.
  cells(): TCoord[] {
    return this.shape.cells();
  }

  // The cell that the piece puts on each coordinate that it covers:
  // a color in Lines, a stack in Sort and the id of the piece in Fit.
  // A cell is a value, so the caller and the piece share it.
  cell(): TCell {
    return this.content;
  }

  clone(): Piece<TCell, TCoord> {
    return new Piece(this.shape, this.content);
  }

  // Two pieces are equal when they cover the same coordinates and hold an equal content.
  // The topology compares the coordinates. `sameContent` compares the contents,
  // because `TCell` has no `equals`.
  equals(
    other: Piece<TCell, TCoord>,
    topology: { key(c: TCoord): CoordKey },
    sameContent: (left: TCell, right: TCell) => boolean,
  ): boolean {
    return (
      sameContent(this.content, other.content) &&
      BoardShape.of(this.shape.cells()).equals(BoardShape.of(other.shape.cells()), topology)
    );
  }
}
