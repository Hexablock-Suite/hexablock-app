import type { GridTopology } from '../../../src/domain/engine/grid-topology';
import {
  TriangleTopology,
  type TriangleAxis,
  type TriangleCoord,
} from '../../../src/domain/engine/triangle-topology';
import { withOwnMethods } from './own-methods';

export {
  isUp,
  triangle,
  TriangleAxis,
  type TriangleCoord,
} from '../../../src/domain/engine/triangle-topology';

// The real triangle topology (issue 160). The tests keep this name.
export const triangleTopology: GridTopology<TriangleCoord, TriangleAxis> = withOwnMethods(
  new TriangleTopology(),
);
