import type { LevelDefinition } from '../../progress/level-definition';
import type { BoardState } from '../board/board-state';
import type { Cloneable } from '../cloneable';
import type { IVariantFactory } from './variant-factory';

// The part of a variant with levels that turns one level into a variant factory (issue #172).
// `factoryOf()` gives the definition the level builder of the variant: the definition directs
// the builder (classes.md decision 15), and the variant factory takes the built level.
// The builder refuses a level of another figure (S3-08 in #151).
// It names only domain types, so it lives in the engine (issue #407, classes.md decision 59).
// Each variant with levels writes its own level function in its folder, next to its level
// builder and its variant factory: `fitLevelVariant()` and `sortLevelVariant()`.
export interface LevelVariant<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  factoryOf(definition: LevelDefinition): IVariantFactory<TCell, TCoord, TMove, TState, unknown>;
}
