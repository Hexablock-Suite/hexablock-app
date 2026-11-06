/** @jest-environment node */
import { CellNode, ShapeGroup, type ShapeNode } from '../../../src/domain/engine/shape-node';

describe('ShapeGroup', () => {
  it('should_keep_the_area_when_the_caller_changes_the_children_array', () => {
    const children: ShapeNode<number>[] = [new CellNode(0), new CellNode(1)];
    const group = new ShapeGroup(children);

    children.push(new CellNode(2));

    expect(group.area()).toBe(2);
    expect(group.cells()).toEqual([0, 1]);
    expect(group.children).toHaveLength(2);
  });

  it('should_throw_and_keep_the_area_when_a_caller_pushes_into_the_children_property', () => {
    const group = new ShapeGroup<number>([new CellNode(0), new CellNode(1)]);
    // `readonly` holds only at compile time, so the cast stands for a caller that ignores it.
    const children = group.children as ShapeNode<number>[];

    expect(() => children.push(new CellNode(2))).toThrow(TypeError);
    expect(group.area()).toBe(2);
  });
});
