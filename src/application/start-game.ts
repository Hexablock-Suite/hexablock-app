import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import { GameEngine } from '../domain/engine/game-engine';
import type { GameEventPublisher } from '../domain/engine/game-events';
import type { IVariantFactory } from '../domain/engine/variant-factory';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, Result } from './result';
import type { RunningGameStore } from './running-game-store';
import type { UseCase } from './use-case';

// The request of `StartGame`. It has no member yet: `levelId` is a planned member
// (docs/architecture/flows.md, flow 3).
export type StartGameRequest = Readonly<Record<string, never>>;

// Opens a new game of one variant (APP-FR-01, APP-FR-03, view 3.2).
// It reads only `IVariantFactory`, so it never names a variant (classes.md decision 31).
// The composition root injects the factory of the chosen game and the event publisher.
// It creates the engine, starts it from the first state, and keeps it in the store.
// A factory that throws gives a `start-failed` failure, and the store keeps its old game.
export class StartGame<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece = unknown,
> implements UseCase<StartGameRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(
    private readonly factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
    private readonly games: RunningGameStore<TCell, TCoord, TMove, TState>,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(
    _request: StartGameRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = new GameEngine<TCell, TCoord, TMove, TState>(
        this.factory.gameId,
        this.factory.createRules(),
        this.factory.createScoring(),
        this.events,
        this.factory.createHistory(),
      );
      engine.start(this.factory.createInitialState());
      this.games.replace(engine);
      return Result.success(moveResultOf(engine, 'playing'));
    } catch (thrown) {
      return Result.failure(caughtError('start-failed', thrown));
    }
  }
}
