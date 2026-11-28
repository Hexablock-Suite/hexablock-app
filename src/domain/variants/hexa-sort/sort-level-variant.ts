import type { Clock } from '../../engine/turn/clock';
import type { GeometryFactory } from '../../engine/geometry/geometry-factory';
import type { LevelVariant } from '../../engine/factory/level-variant';
import type { RandomSource } from '../../engine/random/random-source';
import type { ColorStack } from './color-stack';
import type { PlaceStack } from './place-stack';
import { SortFactory } from './sort-factory';
import { SortLevelBuilder } from './sort-level-builder';
import type { SortState } from './sort-state';

// The levels of Hexa Sort on the geometry `geometry`. `SortLevelBuilder` builds each level,
// and `SortFactory` takes it with the random source `random` and the clock of its level timer
// (issue #46). A level file names its seed or its stacks, so its games draw nothing from `random`
// (issue #417).
// The function lives next to the builder and the factory that it pairs, because the three
// change for the same reasons (issue #407, classes.md decision 59).
export function sortLevelVariant<TCoord>(
  geometry: GeometryFactory<TCoord>,
  random: RandomSource,
  clock: Clock,
): LevelVariant<ColorStack, TCoord, PlaceStack<TCoord>, SortState<TCoord>> {
  return {
    factoryOf: (definition) =>
      new SortFactory(
        geometry,
        definition.buildWith(new SortLevelBuilder(geometry)),
        random,
        clock,
      ),
  };
}
