import type { GeometryFactory } from './geometry-factory';
import { TopologyId } from '../shared/topology-id';
import { CellNode, ShapeGroup, type ShapeNode } from './shape-node';
import { square, SquareTopology, type SquareCoord } from './square-topology';

// The piece shapes as data. Each cell is relative to the origin of the piece.
// The statement gives 1 to 5 cells per piece and no list, so this list is a design choice.
// The list has the same seven forms as the hexagonal list, so the figure of the board
// does not change the sizes of the pieces (APP-FR-16).
// This list is the base set of the family, for every game on this figure.
// A jury variation never edits it (APP-NFR-06): a new Lines shape is data of one board figure
// in src/infrastructure/registered-games.ts (docs/EXTENSIBILITY.md, issue #369).
const pieces: readonly (readonly SquareCoord[])[] = [
  [square(0, 0)],
  [square(0, 0), square(1, 0)],
  [square(0, 0), square(1, 0), square(2, 0)],
  [square(0, 0), square(1, 0), square(0, 1)],
  [square(0, 0), square(1, 0), square(2, 0), square(3, 0)],
  [square(0, 0), square(1, 0), square(0, 1), square(1, 1)],
  [square(0, 0), square(1, 0), square(2, 0), square(3, 0), square(4, 0)],
];

// Concrete Factory (classes.md decision 17, D11): the real square family.
export class SquareGeometry implements GeometryFactory<SquareCoord> {
  private readonly family = TopologyId.square;

  // True when `id` names the square family.
  isOfFamily(id: TopologyId): boolean {
    return this.family.equals(id);
  }

  // `values` holds `col` and then `row`.
  createCoord(values: number[]): SquareCoord {
    const [col, row] = values;
    if (values.length !== 2 || col === undefined || row === undefined) {
      throw new RangeError(`A square coordinate needs two values, not ${values.length}.`);
    }
    return square(col, row);
  }

  createTopology(): SquareTopology {
    return new SquareTopology();
  }

  // Each call gives a new list, so a change by one caller stays with that caller.
  createPieceShapes(): ShapeNode<SquareCoord>[] {
    return pieces.map((cells) => new ShapeGroup(cells.map((c) => new CellNode(c))));
  }
}
