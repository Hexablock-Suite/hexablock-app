import type { BoardShape } from './board-shape';
import type { Cloneable } from './cloneable';
import type { Axis, GridTopology } from './grid-topology';

// The generic board: the `HexBoard<TCell>` of statement §3.1 with a generic coordinate.
// Iterator: `line()`, `ring()` and `neighborhood()` walk the board lazily.
// Prototype: `clone()` takes the snapshot for undo (classes.md decision 7).
// The board asks its topology for every coordinate (classes.md decision 16).
// A cell is a value. The board copies the references to the cells, never the cells.
// So `clone()` shares the cell objects with the original board.
// A caller must not change a cell object. To change a cell, the caller sets a new cell.
// Each coordinate of the shape has its own topology key. Two equal keys are an error.
export class Board<TCell, TCoord> implements Cloneable<Board<TCell, TCoord>> {
  private readonly inside: ReadonlySet<string>;
  private readonly content: Map<string, [TCoord, TCell]>;

  constructor(
    readonly shape: BoardShape<TCoord>,
    readonly topology: GridTopology<TCoord>,
    content: ReadonlyMap<string, [TCoord, TCell]> = new Map(),
  ) {
    this.inside = new Set(shape.cells.map((c) => topology.key(c)));
    if (this.inside.size !== shape.cells.length) {
      throw new RangeError('Two coordinates of the shape have the same key.');
    }
    this.content = new Map(content);
  }

  contains(c: TCoord): boolean {
    return this.inside.has(this.topology.key(c));
  }

  get(at: TCoord): TCell | undefined {
    return this.content.get(this.topology.key(at))?.[1];
  }

  // Changes the board in place. A coordinate outside the shape is an error.
  set(c: TCoord, cell: TCell): void {
    if (!this.contains(c)) {
      throw new RangeError(`The coordinate ${this.topology.key(c)} is outside the board.`);
    }
    this.content.set(this.topology.key(c), [c, cell]);
  }

  // The filled cells as new pairs, so a caller cannot change the board through them.
  cells(): [TCoord, TCell][] {
    return [...this.content.values()].map(([c, cell]) => [c, cell]);
  }

  line(axis: Axis, through: TCoord): Iterable<TCoord> {
    return this.topology.line(axis, through, (c) => this.contains(c));
  }

  *ring(center: TCoord, radius: number): Iterable<TCoord> {
    for (const c of this.topology.ring(center, radius)) {
      if (this.contains(c)) yield c;
    }
  }

  *neighborhood(c: TCoord): Iterable<TCoord> {
    for (const n of this.topology.neighbors(c)) {
      if (this.contains(n)) yield n;
    }
  }

  clone(): Board<TCell, TCoord> {
    return new Board(this.shape, this.topology, this.content);
  }
}
