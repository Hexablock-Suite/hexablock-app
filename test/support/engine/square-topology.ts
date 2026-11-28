import type { GridTopology } from '../../../src/domain/engine/geometry/grid-topology';
import {
  SquareTopology,
  type SquareAxis,
  type SquareCoord,
} from '../../../src/domain/engine/geometry/square-topology';
import { withOwnMethods } from './own-methods';

export {
  square,
  SquareAxis,
  type SquareCoord,
} from '../../../src/domain/engine/geometry/square-topology';

// The real square topology (issue 160). The tests keep this name.
export const squareTopology: GridTopology<SquareCoord, SquareAxis> = withOwnMethods(
  new SquareTopology(),
);
