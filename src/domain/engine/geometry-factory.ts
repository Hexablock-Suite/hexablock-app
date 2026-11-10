import type { GridTopology } from './grid-topology';
import type { ShapeNode } from './shape-node';

// The id of one geometry family. A level names its family with this id in `topology` (DS-6).
export type TopologyId = 'hex' | 'square' | 'triangle';

// Abstract Factory (statement §3.3, classes.md decision 17, D11).
// One factory creates the coordinate, the topology and the piece shapes of one geometry.
// `BoardBuilder` and each variant factory receive a factory by composition,
// so no class exists per game and geometry.
// `id` names the family as data, so a caller compares it and reads no concrete class.
// `createCoord()` takes the values of one coordinate and checks them at runtime,
// because a level file has no compile-time types.
// The contract takes `string` for the axis and direction unions, because no caller reads them.
export interface GeometryFactory<TCoord> {
  readonly id: TopologyId;
  createCoord(values: number[]): TCoord;
  createTopology(): GridTopology<TCoord, string, string>;
  createPieceShapes(): ShapeNode<TCoord>[];
}
