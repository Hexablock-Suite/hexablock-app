import { TopologyId, type GeometryFactory } from './geometry-factory';
import { hex, HexTopology, type HexCoord } from './hex-topology';
import { CellNode, ShapeGroup, type ShapeNode } from './shape-node';

// The piece shapes as data. Each cell is relative to the origin of the piece.
// The statement gives 1 to 5 cells per piece and no list, so this list is a design choice.
// A new shape is one new line (the piece shape row of statement §8).
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
  readonly id = TopologyId.hex;

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
