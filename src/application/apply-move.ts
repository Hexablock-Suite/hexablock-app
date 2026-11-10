import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import { logEntryOf, type Logger } from './logger';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
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
// - `move-failed`: the engine throws before it saves the turn, for example after the game ends.
// The engine saves the turn before it publishes. So a publisher failure gives a success
// built from the saved state (decision 29), and `logger` gets a `publish-failed` entry
// (issue 132). `tryPlay()` returns the `Resolution` of the turn, a domain value. The publisher
// failure is no domain concept (decision 48): the engine gives it to the handler
// that `ApplyMove` passes. `ApplyMove` logs nothing else: the logging aspect logs each call.
export class ApplyMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(
    private readonly games: RunningGameStore<TCell, TCoord, TMove, TState>,
    private readonly logger: Logger,
  ) {}

  async execute(
    request: ApplyMoveRequest<TMove>,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = this.games.current();
      if (engine === undefined) {
        return Result.failure(new UseCaseError('no-running-game', 'No game is running.'));
      }
      const turn = engine.tryPlay(request.move, (error) => this.logPublishFailure(error));
      if (!turn.accepted) {
        return Result.failure(new UseCaseError('move-rejected', 'The rules rejected the move.'));
      }
      return Result.success(moveResultOf(engine, turn.outcome));
    } catch (thrown) {
      return Result.failure(caughtError('move-failed', thrown));
    }
  }

  // The turn is already saved. A logger that throws here must not change the answer, so
  // this method drops that error. A logging aspect around `ApplyMove` reports a broken logger.
  private logPublishFailure(error: unknown): void {
    try {
      this.logger.log(
        logEntryOf('ApplyMove', Result.failure(caughtError('publish-failed', error))),
      );
    } catch {
      return;
    }
  }
}
