import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameEvent } from '../domain/engine/game-events';
import type { GameEventPublisher } from './game-event-publisher';
import { logEntryOf, type Logger } from './logger';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, FailureCode, Result, UseCaseError } from './result';
import type { GameRepository } from './game-repository';
import type { UseCase } from './use-case';

// The request of `ApplyMove`: the move only (docs/architecture/flows.md).
export interface ApplyMoveRequest<TMove> {
  readonly move: TMove;
}

// Plays one move on the running game (APP-FR-03, view 3.2).
// The engine plays the turn, so the turn cycle stays in the domain (D1).
// No exception leaves `execute()`. The failures:
// - `no-running-game`: the repository has no engine.
// - `move-rejected`: the rules reject the move. The engine keeps its state.
// - `move-failed`: the engine throws before it saves the turn, for example after the game ends.
// The engine records its events and tells nobody (decision 52). After the turn, `ApplyMove`
// takes the events of the engine and gives each one to `events`, the publisher port (#233).
// The turn is saved before the delivery. So a publisher failure gives a success built from
// the saved state (decision 29), and `logger` gets a `publish-failed` entry (issue 132).
// The publisher failure is no domain concept (decision 48), so it stays in this use case.
// `ApplyMove` logs nothing else: the logging aspect logs each call.
export class ApplyMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(
    private readonly games: GameRepository<TCell, TCoord, TMove, TState>,
    private readonly logger: Logger,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(
    request: ApplyMoveRequest<TMove>,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = this.games.current();
      if (engine === undefined) {
        return Result.failure(new UseCaseError(FailureCode.noRunningGame, 'No game is running.'));
      }
      const turn = engine.tryPlay(request.move);
      this.deliver(engine.takeEvents());
      if (!turn.wasAccepted()) {
        return Result.failure(
          new UseCaseError(FailureCode.moveRejected, 'The rules rejected the move.'),
        );
      }
      return Result.success(moveResultOf(engine, turn.leadsTo()));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.moveFailed, thrown));
    }
  }

  // Gives each event of the turn to the publisher. The turn is already saved, so a publisher
  // that throws must not change the answer: this method logs the error and goes on.
  private deliver(events: readonly GameEvent[]): void {
    for (const event of events) {
      try {
        this.events.publish(event);
      } catch (error) {
        this.logPublishFailure(error);
      }
    }
  }

  // The turn is already saved. A logger that throws here must not change the answer, so
  // this method drops that error. A logging aspect around `ApplyMove` reports a broken logger.
  private logPublishFailure(error: unknown): void {
    try {
      this.logger.log(
        logEntryOf('ApplyMove', Result.failure(caughtError(FailureCode.publishFailed, error))),
      );
    } catch {
      return;
    }
  }
}
