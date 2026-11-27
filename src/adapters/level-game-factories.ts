import type { GameFactories } from '../application/game-factories';
import type { LevelRepository } from '../application/level-repository';
import type { BoardState } from '../domain/engine/board-state';
import type { Clock } from '../domain/engine/clock';
import type { Cloneable } from '../domain/engine/cloneable';
import { GameFactory } from '../domain/engine/game-factory';
import type { GameId } from '../domain/shared/game-id';
import type { GeometryFactory } from '../domain/engine/geometry-factory';
import type { LevelDefinition } from '../domain/progress/level-definition';
import type { LevelId } from '../domain/progress/level-id';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import type { IProgressModel } from '../domain/progress/progress-model';
import type { RandomSource } from '../domain/engine/random-source';
import type { IVariantFactory } from '../domain/engine/variant-factory';
import { FitFactory } from '../domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../domain/variants/hexa-fit/fit-level-builder';
import type { FitMove } from '../domain/variants/hexa-fit/fit-move';
import type { FitState } from '../domain/variants/hexa-fit/fit-state';
import type { PieceId } from '../domain/variants/hexa-fit/piece-id';
import type { ColorStack } from '../domain/variants/hexa-sort/color-stack';
import type { PlaceStack } from '../domain/variants/hexa-sort/place-stack';
import { SortFactory } from '../domain/variants/hexa-sort/sort-factory';
import { SortLevelBuilder } from '../domain/variants/hexa-sort/sort-level-builder';
import type { SortState } from '../domain/variants/hexa-sort/sort-state';

const NO_LEVEL = 'The game has no level with this id.';

// The part of a variant with levels that turns one level into a variant factory (issue #172).
// `factoryOf()` gives the definition the level builder of the variant: the definition directs
// the builder (classes.md decision 15), and the variant factory takes the built level.
// The builder refuses a level of another figure (S3-08 in #151).
export interface LevelVariant<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  factoryOf(definition: LevelDefinition): IVariantFactory<TCell, TCoord, TMove, TState, unknown>;
}

// Adapter of the `GameFactories` port of layer 2 (S3-13 in #151, option D, issue #172).
// It gives `StartGame` the `GameFactory` of one game.
// - With no level id, it gives the factory of the variant factory that the composition root
//   registered. A game with no levels, such as Hexa Lines and Hexa Merge, always starts so.
//   A game with levels starts so until the level selector passes a level id (#173).
// - With a level id, it asks `LevelRepository` for the definition of that level of the game,
//   and its `LevelVariant` builds the variant factory of the level. A game with no
//   `LevelVariant` has no levels. A level id that the game does not have rejects the promise
//   with a RangeError, and the error carries the level id as its `cause`.
// Each `GameFactory` takes the `GameId` of the game and the one id generator of the root,
// so the games of every level get the `MatchId` of a new match (decision 40).
// The factory of a level also takes its level id, so each game of the level keeps it
// (decision 61, #180).
// `progressModelFor()` gives the progress model of the same variant factory: a level counts
// its stars with its own star rule, so the composition root builds `SaveProgress` with the
// model of the level of the finished game (#180).
// This file is the code of layer 3 that knows the variants with levels:
// `fitLevelVariant()` and `sortLevelVariant()` pair each level builder with its variant factory.
export class LevelGameFactories<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements GameFactories<TCell, TCoord, TMove, TState> {
  private readonly registered: GameFactory<TCell, TCoord, TMove, TState>;

  constructor(
    private readonly gameId: GameId,
    private readonly variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
    private readonly ids: MatchIdGenerator,
    private readonly levels: LevelRepository,
    private readonly levelVariant?: LevelVariant<TCell, TCoord, TMove, TState>,
  ) {
    this.registered = new GameFactory(gameId, variant, ids);
  }

  async factoryFor(levelId?: LevelId): Promise<GameFactory<TCell, TCoord, TMove, TState>> {
    if (levelId === undefined) return this.registered;
    return new GameFactory(this.gameId, await this.variantOf(levelId), this.ids, levelId);
  }

  // The progress model of the level `levelId`, or of the registered variant factory with no
  // level id. A level id that the game does not have rejects the promise, as `factoryFor()` does.
  async progressModelFor(levelId?: LevelId): Promise<IProgressModel> {
    if (levelId === undefined) return this.variant.createProgressModel();
    return (await this.variantOf(levelId)).createProgressModel();
  }

  // The variant factory of the level `levelId` of the game.
  private async variantOf(
    levelId: LevelId,
  ): Promise<IVariantFactory<TCell, TCoord, TMove, TState, unknown>> {
    const { levelVariant } = this;
    if (levelVariant === undefined) throw new RangeError(NO_LEVEL, { cause: levelId });
    const definition = await this.levels.levelOf(this.gameId, levelId);
    if (definition === undefined) throw new RangeError(NO_LEVEL, { cause: levelId });
    return levelVariant.factoryOf(definition);
  }
}

// The levels of Hexa Fit on the geometry `geometry`. `FitLevelBuilder` builds each level,
// and `FitFactory` takes it with the clock of its level timer (classes.md decision 19).
export function fitLevelVariant<TCoord>(
  geometry: GeometryFactory<TCoord>,
  clock: Clock,
): LevelVariant<PieceId, TCoord, FitMove<TCoord>, FitState<TCoord>> {
  return {
    factoryOf: (definition) =>
      new FitFactory(geometry, definition.buildWith(new FitLevelBuilder(geometry)), clock),
  };
}

// The levels of Hexa Sort on the geometry `geometry`. `SortLevelBuilder` builds each level,
// and `SortFactory` takes it with the random source `random`. A level file names its seed
// or its stacks, so its games draw nothing from `random` (issue #417).
export function sortLevelVariant<TCoord>(
  geometry: GeometryFactory<TCoord>,
  random: RandomSource,
): LevelVariant<ColorStack, TCoord, PlaceStack<TCoord>, SortState<TCoord>> {
  return {
    factoryOf: (definition) =>
      new SortFactory(geometry, definition.buildWith(new SortLevelBuilder(geometry)), random),
  };
}
