import type { GameFactories } from '../application/game-factories';
import type { LevelRepository } from '../application/level-repository';
import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import { GameFactory } from '../domain/engine/game-factory';
import type { LevelVariant } from '../domain/engine/level-variant';
import type { GameId } from '../domain/shared/game-id';
import type { LevelId } from '../domain/progress/level-id';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import type { IProgressModel } from '../domain/progress/progress-model';
import type { IVariantFactory } from '../domain/engine/variant-factory';

const NO_LEVEL = 'The game has no level with this id.';

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
// It names no variant (rule `level-game-factories-no-variants`, issue #407): `LevelVariant`
// lives in the engine, and each variant folder holds its own level function, which pairs its
// level builder with its variant factory.
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
