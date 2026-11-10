import type { GeometryFactory } from './geometry-factory';
import { CellNode, ShapeGroup, type ShapeNode } from './shape-node';
import { triangle, TriangleTopology, type TriangleCoord } from './triangle-topology';

// The piece shapes as data. Each cell is relative to the origin of the piece.
// The statement gives 1 to 5 cells per piece and no list, so this list is a design choice.
// The list has the same piece sizes as the hexagonal list (APP-FR-16).
// A translation keeps the orientation of each triangle, so a piece covers only cells
// of its own orientations. The list holds 11 up triangles and 11 down triangles,
// so the pieces can fill both kinds of cell.
// A new shape is one new line (the piece shape row of statement §8).
const pieces: readonly (readonly TriangleCoord[])[] = [
  [triangle(0, 0)],
  [triangle(0, 0), triangle(1, 0)],
  [triangle(0, 0), triangle(1, 0), triangle(2, 0)],
  [triangle(0, 0), triangle(1, 0), triangle(0, 1)],
  [triangle(0, 0), triangle(1, 0), triangle(2, 0), triangle(3, 0)],
  [triangle(0, 0), triangle(-1, 0), triangle(1, 0), triangle(0, 1)],
  [triangle(0, 0), triangle(1, 0), triangle(2, 0), triangle(3, 0), triangle(4, 0)],
];

// Concrete Factory (classes.md decision 17, D11): the real triangle family.
export class TriangleGeometry implements GeometryFactory<TriangleCoord> {
  readonly id = 'triangle';

  // `values` holds `col` and then `row`.
  createCoord(values: number[]): TriangleCoord {
    const [col, row] = values;
    if (values.length !== 2 || col === undefined || row === undefined) {
      throw new RangeError(`A triangle coordinate needs two values, not ${values.length}.`);
    }
    return triangle(col, row);
  }

  createTopology(): TriangleTopology {
    return new TriangleTopology();
  }

  // Each call gives a new list, so a change by one caller stays with that caller.
  createPieceShapes(): ShapeNode<TriangleCoord>[] {
    return pieces.map((cells) => new ShapeGroup(cells.map((c) => new CellNode(c))));
  }
}
