import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameId } from '../domain/shared/game-id';
import type { TopologyId } from '../domain/shared/topology-id';
import type { LevelId } from '../domain/progress/level-id';
import { LevelStatus } from '../domain/progress/level-status';
import { Outcome } from '../domain/engine/outcome';
import type { GameFactories } from './game-factories';
import type { GameRepository } from './game-repository';
import type { LevelRepository } from './level-repository';
import { levelsOnFigure } from './list-levels';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import type { ProgressRepository } from './progress-repository';
import { caughtError, FailureCode, Result, UseCaseError } from './result';
import type { UseCase } from './use-case';

// The request of `StartGame` (S3-13 in #151, issue #172). `levelId` names the level
// that the player chose. It is optional, because a game with no levels has no level id.
export interface StartGameRequest {
  readonly levelId?: LevelId;
}

const LOCKED = 'The level is locked.';

// Opens a new game of one variant (APP-FR-01, APP-FR-03, view 3.2).
// It asks its `GameFactories` port for the `GameFactory` of the level of the request,
// asks that factory for the started game and saves it in the game repository
// (classes.md decisions 10 and 40). So the use case keeps the choice of the level.
// It builds no part of the game, so it never names a variant.
// The composition root builds one `StartGame` for each game and figure, with its aspects,
// and injects the port that `LevelGameFactories` of layer 3 implements.
// A request with a level id starts only a level that the player can play (APP-FR-02, #397).
// Every caller passes here, so a link to a locked level cannot start it.
// The use case lists the levels of its game on its figure in the order of their files,
// as `ListLevels` does, and asks `LevelStatus.ofEach()` for the status of the level.
// A completed level and an open level start. A locked level gives a `level-locked` failure.
// With no progress repository, or with no saved progress, only the first level is open.
// A level id that the list does not hold goes to the port, which rejects it.
// A port that rejects the level, a port that throws or a factory that throws gives
// a `start-failed` failure. A failed start keeps the old game of the repository.
export class StartGame<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<StartGameRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(
    private readonly factories: GameFactories<TCell, TCoord, TMove, TState>,
    private readonly games: GameRepository<TCell, TCoord, TMove, TState>,
    private readonly levels: LevelRepository,
    private readonly progress: ProgressRepository | undefined,
    private readonly gameId: GameId,
    private readonly figure: TopologyId,
  ) {}

  async execute(
    request: StartGameRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const { levelId } = request;
      if (levelId !== undefined && (await this.isLocked(levelId))) {
        return Result.failure(new UseCaseError(FailureCode.levelLocked, LOCKED));
      }
      const factory = await this.factories.factoryFor(levelId);
      const engine = factory.createGame();
      this.games.replace(engine);
      return Result.success(moveResultOf(engine, Outcome.playing));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.startFailed, thrown));
    }
  }

  // Whether `LevelStatus.ofEach()` gives the level `levelId` the status `locked`.
  // A level that the list of the figure does not hold is not locked.
  private async isLocked(levelId: LevelId): Promise<boolean> {
    const levels = levelsOnFigure(await this.levels.list(this.gameId), this.figure);
    const progress = await this.progress?.load(this.gameId);
    const found = LevelStatus.ofEach(levels, progress).find(([level]) =>
      level.levelId().equals(levelId),
    );
    return found !== undefined && found[1].equals(LevelStatus.locked);
  }
}
