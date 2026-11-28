import type { GridTopology } from './grid-topology';
import type { ShapeNode } from './shape-node';
import type { TopologyId } from '../../shared/topology-id';

// Abstract Factory (statement §3.3, classes.md decision 17, D11).
// One factory creates the coordinate, the topology and the piece shapes of one geometry.
// `BoardBuilder` and each variant factory receive a factory by composition,
// so no class exists per game and geometry.
// Each factory keeps the `TopologyId` of its family private. `isOfFamily()` tells whether
// the factory is of a family, so a caller asks the factory and reads no concrete class (issue #234).
// `createCoord()` takes the values of one coordinate and checks them at runtime,
// because a level file has no compile-time types.
// The contract gives a topology with any axis and any direction, because no caller reads them.
export interface GeometryFactory<TCoord> {
  isOfFamily(id: TopologyId): boolean;
  createCoord(values: number[]): TCoord;
  createTopology(): GridTopology<TCoord>;
  createPieceShapes(): ShapeNode<TCoord>[];
}
