import type { GridTopology } from './grid-topology';

// Composite (statement §3.3): a shape is a tree of cells.
// Every coordinate calculation goes to the topology (classes.md decision 16).
export interface ShapeNode<TCoord> {
  cells(): TCoord[];
  area(): number;
  rotated(steps: number, topology: GridTopology<TCoord>): ShapeNode<TCoord>;
  translated(offset: TCoord, topology: GridTopology<TCoord>): ShapeNode<TCoord>;
}

// Leaf: one cell of a shape.
export class CellNode<TCoord> implements ShapeNode<TCoord> {
  constructor(readonly at: TCoord) {}

  cells(): TCoord[] {
    return [this.at];
  }

  area(): number {
    return 1;
  }

  rotated(steps: number, topology: GridTopology<TCoord>): CellNode<TCoord> {
    return new CellNode(topology.rotate(this.at, steps));
  }

  translated(offset: TCoord, topology: GridTopology<TCoord>): CellNode<TCoord> {
    return new CellNode(topology.translate(this.at, offset));
  }
}

// Composite: a group of shapes. A group holds at least one child.
export class ShapeGroup<TCoord> implements ShapeNode<TCoord> {
  readonly children: readonly ShapeNode<TCoord>[];

  constructor(children: readonly ShapeNode<TCoord>[]) {
    if (children.length === 0) throw new RangeError('A shape group holds at least one child.');
    this.children = [...children];
  }

  cells(): TCoord[] {
    return this.children.flatMap((child) => child.cells());
  }

  area(): number {
    return this.children.reduce((sum, child) => sum + child.area(), 0);
  }

  rotated(steps: number, topology: GridTopology<TCoord>): ShapeGroup<TCoord> {
    return new ShapeGroup(this.children.map((child) => child.rotated(steps, topology)));
  }

  translated(offset: TCoord, topology: GridTopology<TCoord>): ShapeGroup<TCoord> {
    return new ShapeGroup(this.children.map((child) => child.translated(offset, topology)));
  }
}
