import type { GridTopology } from './grid-topology';
import type { ShapeNode } from './shape-node';

// Abstract Factory (statement §3.3, classes.md decision 17, D11).
// One factory creates the coordinate, the topology and the piece shapes of one geometry.
// `BoardBuilder` receives a factory by composition, so no class exists per game and geometry.
// `createCoord()` takes the values of one coordinate and checks them at runtime,
// because a level file has no compile-time types.
// The contract takes `string` for the axis and direction unions, because no caller reads them.
export interface GeometryFactory<TCoord> {
  createCoord(values: number[]): TCoord;
  createTopology(): GridTopology<TCoord, string, string>;
  createPieceShapes(): ShapeNode<TCoord>[];
}
