import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import { moveResultOf, type MoveResult } from './move-result';
import { caughtError, Result, UseCaseError } from './result';
import type { RunningGameStore } from './running-game-store';
import type { UseCase } from './use-case';

// The request of `ApplyMove`: the move only (docs/architecture/flows.md).
export interface ApplyMoveRequest<TMove> {
  readonly move: TMove;
}

// Plays one move on the running game (APP-FR-03, view 3.2).
// The engine plays the turn, so the turn cycle stays in the domain (D1).
// No exception leaves `execute()`. The failures:
// - `no-running-game`: the store has no engine.
// - `move-rejected`: the rules reject the move. The engine keeps its state.
// - `move-failed`: the engine throws, for example after the game ends.
export class ApplyMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord>> {
  constructor(private readonly games: RunningGameStore<TCell, TCoord, TMove, TState>) {}

  async execute(request: ApplyMoveRequest<TMove>): Promise<Result<MoveResult<TCell, TCoord>>> {
    try {
      const engine = this.games.current();
      if (engine === undefined) {
        return Result.failure(new UseCaseError('no-running-game', 'No game is running.'));
      }
      const turn = engine.tryPlay(request.move);
      if (!turn.accepted) {
        return Result.failure(new UseCaseError('move-rejected', 'The rules rejected the move.'));
      }
      return Result.success(moveResultOf(engine.snapshot(), turn.outcome));
    } catch (thrown) {
      return Result.failure(caughtError('move-failed', thrown));
    }
  }
}
