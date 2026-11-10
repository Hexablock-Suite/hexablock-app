import type { GridTopology } from '../../../src/domain/engine/grid-topology';
import {
  SquareTopology,
  type SquareAxis,
  type SquareCoord,
  type SquareDirection,
} from '../../../src/domain/engine/square-topology';
import { withOwnMethods } from './own-methods';

export {
  square,
  SquareAxis,
  type SquareCoord,
  SquareDirection,
} from '../../../src/domain/engine/square-topology';

// The real square topology (issue 160). The tests keep this name.
export const squareTopology: GridTopology<SquareCoord, SquareAxis, SquareDirection> =
  withOwnMethods(new SquareTopology());
