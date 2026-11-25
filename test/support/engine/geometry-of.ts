import type { GeometryFactory } from '../../../src/domain/engine/geometry-factory';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { SquareGeometry } from '../../../src/domain/engine/square-geometry';
import { TriangleGeometry } from '../../../src/domain/engine/triangle-geometry';

// A test that needs the geometry of one board figure. The geometry keeps its coordinate type,
// so the test reads the coordinates of a level file through it (issue #354).
export interface GeometryUser<R> {
  use<TCoord>(geometry: GeometryFactory<TCoord>): R;
}

// Gives `user` the geometry of the figure that `topology` names, the `topology` text
// of a level file: `hex`, `square` or `triangle`. It returns what `user` returns.
// Another text throws a RangeError.
export function withGeometryOf<R>(topology: string, user: GeometryUser<R>): R {
  if (topology === 'hex') return user.use(new HexGeometry());
  if (topology === 'square') return user.use(new SquareGeometry());
  if (topology === 'triangle') return user.use(new TriangleGeometry());
  throw new RangeError(`No board figure has the topology ${topology}.`);
}
