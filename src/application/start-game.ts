import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { LevelId } from '../domain/engine/level-id';
import { Outcome } from '../domain/engine/outcome';
import type { GameFactories } from './game-factories';
import type { GameRepository } from './game-repository';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, Result } from './result';
import type { UseCase } from './use-case';

// The request of `StartGame` (S3-13 in #151, issue #172). `levelId` names the level
// that the player chose. It is optional, because a game with no levels has no level id.
export interface StartGameRequest {
  readonly levelId?: LevelId;
}

// Opens a new game of one variant (APP-FR-01, APP-FR-03, view 3.2).
// It asks its `GameFactories` port for the `GameFactory` of the level of the request,
// asks that factory for the started game and saves it in the game repository
// (classes.md decisions 10 and 40). So the use case keeps the choice of the level.
// It builds no part of the game, so it never names a variant.
// The composition root builds one `StartGame` for each game, with its aspects,
// and injects the port that `LevelGameFactories` of layer 3 implements.
// A port that rejects the level, or a factory that throws, gives a `start-failed` failure,
// and the repository keeps its old game.
export class StartGame<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<StartGameRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(
    private readonly factories: GameFactories<TCell, TCoord, TMove, TState>,
    private readonly games: GameRepository<TCell, TCoord, TMove, TState>,
  ) {}

  async execute(
    request: StartGameRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const factory = await this.factories.factoryFor(request.levelId);
      const engine = factory.createGame();
      this.games.replace(engine);
      return Result.success(moveResultOf(engine, Outcome.playing));
    } catch (thrown) {
      return Result.failure(caughtError('start-failed', thrown));
    }
  }
}
