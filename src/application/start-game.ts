import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameFactory } from '../domain/engine/game-factory';
import { Outcome } from '../domain/engine/outcome';
import type { GameRepository } from './game-repository';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, Result } from './result';
import type { UseCase } from './use-case';

// The request of `StartGame`. It has no member yet: `levelId` is a planned member
// (docs/architecture/flows.md, flow 3).
export type StartGameRequest = Readonly<Record<string, never>>;

// Opens a new game of one variant (APP-FR-01, APP-FR-03, view 3.2).
// It asks `GameFactory` for the started game and saves it in the game repository
// (classes.md decisions 10 and 40).
// It builds no part of the game, so it never names a variant.
// The composition root injects a `GameFactory` that holds the variant factory of the chosen game,
// the id generator and the event publisher.
// A factory that throws gives a `start-failed` failure, and the repository keeps its old game.
export class StartGame<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<StartGameRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(
    private readonly factory: GameFactory<TCell, TCoord, TMove, TState>,
    private readonly games: GameRepository<TCell, TCoord, TMove, TState>,
  ) {}

  async execute(
    _request: StartGameRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = this.factory.createGame();
      this.games.replace(engine);
      return Result.success(moveResultOf(engine, Outcome.playing));
    } catch (thrown) {
      return Result.failure(caughtError('start-failed', thrown));
    }
  }
}
