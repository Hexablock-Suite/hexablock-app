/** @jest-environment node */
import { CellNode, ShapeGroup, type ShapeNode } from '../../../src/domain/engine/shape-node';

describe('ShapeGroup', () => {
  it('should_keep_the_area_when_the_caller_changes_the_children_array', () => {
    const children: ShapeNode<number>[] = [new CellNode(0), new CellNode(1)];
    const group = new ShapeGroup(children);

    children.push(new CellNode(2));

    expect(group.area()).toBe(2);
    expect(group.cells()).toEqual([0, 1]);
  });

  // The group keeps its own list, so no write to the caller's array reaches it.
  it('should_keep_its_children_when_the_caller_replaces_and_removes_items_of_the_array', () => {
    const children: ShapeNode<number>[] = [new CellNode(0), new CellNode(1)];
    const group = new ShapeGroup(children);

    children[0] = new CellNode(7);
    children.length = 0;

    expect(group.cells()).toEqual([0, 1]);
    expect(group.area()).toBe(2);
  });

  it('should_keep_its_cells_when_a_caller_changes_the_list_that_cells_returns', () => {
    const group = new ShapeGroup<number>([new CellNode(0), new CellNode(1)]);

    group.cells().push(2);

    expect(group.cells()).toEqual([0, 1]);
    expect(group.area()).toBe(2);
  });
});
