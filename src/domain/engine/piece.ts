import type { Cloneable } from './cloneable';
import type { GridTopology } from './grid-topology';
import type { ShapeNode } from './shape-node';

// One piece type for the four variants: a shape plus the content it puts on the board
// (classes.md decision 6). A piece never changes: each operation returns a new piece.
export class Piece<TCell, TCoord> implements Cloneable<Piece<TCell, TCoord>> {
  constructor(
    readonly shape: ShapeNode<TCoord>,
    readonly content: TCell,
  ) {}

  rotated(steps: number, topology: GridTopology<TCoord>): Piece<TCell, TCoord> {
    return new Piece(this.shape.rotated(steps, topology), this.content);
  }

  translated(offset: TCoord, topology: GridTopology<TCoord>): Piece<TCell, TCoord> {
    return new Piece(this.shape.translated(offset, topology), this.content);
  }

  clone(): Piece<TCell, TCoord> {
    return new Piece(this.shape, this.content);
  }
}
