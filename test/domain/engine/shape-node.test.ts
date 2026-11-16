/** @jest-environment node */
import { Area } from '../../../src/domain/engine/area';
import { CellNode, ShapeGroup, type ShapeNode } from '../../../src/domain/engine/shape-node';

describe('ShapeGroup', () => {
  it('should_keep_the_area_when_the_caller_changes_the_children_array', () => {
    const children: ShapeNode<number>[] = [new CellNode(0), new CellNode(1)];
    const group = new ShapeGroup(children);

    children.push(new CellNode(2));

    expect(group.area().equals(Area.of(2))).toBe(true);
    expect(group.cells()).toEqual([0, 1]);
  });

  // The group keeps its own list, so no write to the caller's array reaches it.
  it('should_keep_its_children_when_the_caller_replaces_and_removes_items_of_the_array', () => {
    const children: ShapeNode<number>[] = [new CellNode(0), new CellNode(1)];
    const group = new ShapeGroup(children);

    children[0] = new CellNode(7);
    children.length = 0;

    expect(group.cells()).toEqual([0, 1]);
    expect(group.area().equals(Area.of(2))).toBe(true);
  });

  it('should_keep_its_cells_when_a_caller_changes_the_list_that_cells_returns', () => {
    const group = new ShapeGroup<number>([new CellNode(0), new CellNode(1)]);

    group.cells().push(2);

    expect(group.cells()).toEqual([0, 1]);
    expect(group.area().equals(Area.of(2))).toBe(true);
  });

  // Issue #243: an area is an `Area`. A leaf counts one cell, and a group adds its children.
  it('should_count_one_cell_per_leaf_when_the_area_of_nested_groups_is_read', () => {
    const inner = new ShapeGroup<number>([new CellNode(0), new CellNode(1)]);
    const outer = new ShapeGroup<number>([inner, new CellNode(2)]);

    expect(new CellNode(0).area().equals(Area.of(1))).toBe(true);
    expect(inner.area().equals(Area.of(2))).toBe(true);
    expect(outer.area().equals(Area.of(3))).toBe(true);
  });
});
