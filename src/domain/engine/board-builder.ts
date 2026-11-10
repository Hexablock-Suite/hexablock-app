import { Board } from './board';
import type { BoardId } from './board-id';
import { BoardShape } from './board-shape';
import type { GeometryFactory } from './geometry-factory';
import type { RegionSize } from './region-size';
import type { ShapeNode } from './shape-node';

// Builder and DDD factory of the board (statement §3.3, classes.md decision 15, D9).
// It builds the logical structure of the board and nothing more.
// It has two construction paths: `withRegion()` for Lines, Sort and Merge,
// and `withFigure()` for the Fit figure. When a caller uses both paths, the last step decides.
// Each step returns the builder, and only `build()` returns the board.
// `build()` calls the `Board` constructor, so the checks of the board apply.
export class BoardBuilder<TCoord> {
  private shape: BoardShape<TCoord> | undefined;

  constructor(private readonly geometry: GeometryFactory<TCoord>) {}

  withRegion(size: RegionSize): BoardBuilder<TCoord> {
    this.shape = this.geometry.createTopology().region(size);
    return this;
  }

  withFigure(figure: ShapeNode<TCoord>): BoardBuilder<TCoord> {
    this.shape = BoardShape.of(figure.cells());
    return this;
  }

  // Each call gives a new empty board with the id `id`.
  // Two boards share only the shape, which never changes.
  build<TCell>(id: BoardId): Board<TCell, TCoord> {
    if (this.shape === undefined) {
      throw new RangeError('A board builder needs a region or a figure.');
    }
    return new Board<TCell, TCoord>(id, this.shape, this.geometry.createTopology());
  }
}
