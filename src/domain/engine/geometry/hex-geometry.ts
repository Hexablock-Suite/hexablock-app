import type { GeometryFactory } from './geometry-factory';
import { TopologyId } from '../../shared/topology-id';
import { hex, HexTopology, type HexCoord } from './hex-topology';
import { CellNode, ShapeGroup, type ShapeNode } from './shape-node';

// The piece shapes as data. Each cell is relative to the origin of the piece.
// The statement gives 1 to 5 cells per piece and no list, so this list is a design choice.
// This list is the base set of the family, for every game on this figure.
// A jury variation never edits it (APP-NFR-06): a new Lines shape is data of one board figure
// in src/infrastructure/registered-games.ts (docs/EXTENSIBILITY.md, issue #369).
const pieces: readonly (readonly HexCoord[])[] = [
  [hex(0, 0)],
  [hex(0, 0), hex(1, 0)],
  [hex(0, 0), hex(1, 0), hex(2, 0)],
  [hex(0, 0), hex(1, 0), hex(0, 1)],
  [hex(0, 0), hex(1, 0), hex(2, 0), hex(3, 0)],
  [hex(0, 0), hex(1, 0), hex(0, 1), hex(1, 1)],
  [hex(0, 0), hex(1, 0), hex(2, 0), hex(3, 0), hex(4, 0)],
];

// Concrete Factory (classes.md decision 17, D11): the real hexagonal family.
export class HexGeometry implements GeometryFactory<HexCoord> {
  private readonly family = TopologyId.hex;

  // True when `id` names the hex family.
  isOfFamily(id: TopologyId): boolean {
    return this.family.equals(id);
  }

  // `values` holds `q` and then `r`.
  createCoord(values: number[]): HexCoord {
    const [q, r] = values;
    if (values.length !== 2 || q === undefined || r === undefined) {
      throw new RangeError(`A hex coordinate needs two values, not ${values.length}.`);
    }
    return hex(q, r);
  }

  createTopology(): HexTopology {
    return new HexTopology();
  }

  // Each call gives a new list, so a change by one caller stays with that caller.
  createPieceShapes(): ShapeNode<HexCoord>[] {
    return pieces.map((cells) => new ShapeGroup(cells.map((c) => new CellNode(c))));
  }
}
