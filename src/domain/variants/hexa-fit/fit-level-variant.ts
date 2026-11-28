import type { Clock } from '../../engine/turn/clock';
import type { GeometryFactory } from '../../engine/geometry/geometry-factory';
import type { LevelVariant } from '../../engine/factory/level-variant';
import { FitFactory } from './fit-factory';
import { FitLevelBuilder } from './fit-level-builder';
import type { FitMove } from './fit-move';
import type { FitState } from './fit-state';
import type { PieceId } from './piece-id';

// The levels of Hexa Fit on the geometry `geometry`. `FitLevelBuilder` builds each level,
// and `FitFactory` takes it with the clock of its level timer (classes.md decision 19).
// The function lives next to the builder and the factory that it pairs, because the three
// change for the same reasons (issue #407, classes.md decision 59).
export function fitLevelVariant<TCoord>(
  geometry: GeometryFactory<TCoord>,
  clock: Clock,
): LevelVariant<PieceId, TCoord, FitMove<TCoord>, FitState<TCoord>> {
  return {
    factoryOf: (definition) =>
      new FitFactory(geometry, definition.buildWith(new FitLevelBuilder(geometry)), clock),
  };
}
