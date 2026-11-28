import { Area } from './area';
import type { GridTopology } from './grid-topology';
import type { Turns } from './turns';

// Composite (statement §3.3): a shape is a tree of cells.
// Every coordinate calculation goes to the topology (classes.md decision 16).
// A shape reads no axis and no direction, so it takes a topology with any axis and any direction.
// The area of a shape is an `Area`, its count of cells (issue #243).
export interface ShapeNode<TCoord> {
  cells(): TCoord[];
  area(): Area;
  rotated(turns: Turns, topology: GridTopology<TCoord>): ShapeNode<TCoord>;
  translated(offset: TCoord, topology: GridTopology<TCoord>): ShapeNode<TCoord>;
}

// Leaf: one cell of a shape.
export class CellNode<TCoord> implements ShapeNode<TCoord> {
  constructor(private readonly at: TCoord) {}

  cells(): TCoord[] {
    return [this.at];
  }

  area(): Area {
    return Area.of(1);
  }

  rotated(turns: Turns, topology: GridTopology<TCoord>): CellNode<TCoord> {
    return new CellNode(topology.rotate(this.at, turns));
  }

  translated(offset: TCoord, topology: GridTopology<TCoord>): CellNode<TCoord> {
    return new CellNode(topology.translate(this.at, offset));
  }
}

// Composite: a group of shapes. A group holds at least one child.
// The group copies the children array, so a change to the caller's array does not change the group.
// The copy is frozen, because `readonly` holds only at compile time.
export class ShapeGroup<TCoord> implements ShapeNode<TCoord> {
  private readonly children: readonly ShapeNode<TCoord>[];

  constructor(children: readonly ShapeNode<TCoord>[]) {
    if (children.length === 0) throw new RangeError('A shape group holds at least one child.');
    this.children = Object.freeze([...children]);
  }

  cells(): TCoord[] {
    return this.children.flatMap((child) => child.cells());
  }

  // The sum of the areas of the children. A group holds at least one child.
  area(): Area {
    return this.children.map((child) => child.area()).reduce((sum, area) => sum.plus(area));
  }

  rotated(turns: Turns, topology: GridTopology<TCoord>): ShapeGroup<TCoord> {
    return new ShapeGroup(this.children.map((child) => child.rotated(turns, topology)));
  }

  translated(offset: TCoord, topology: GridTopology<TCoord>): ShapeGroup<TCoord> {
    return new ShapeGroup(this.children.map((child) => child.translated(offset, topology)));
  }
}
