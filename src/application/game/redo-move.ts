import type { BoardState } from '../../domain/engine/board/board-state';
import type { Cloneable } from '../../domain/engine/cloneable';
import { Outcome } from '../../domain/engine/events/outcome';
import type { GameRepository } from '../ports/game-repository';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, FailureCode, Result, UseCaseError } from '../result';
import type { UseCase } from '../use-case';

// The request of `RedoMove`. It has no member: the running game holds its undone moves.
export type RedoMoveRequest = Readonly<Record<string, never>>;

// Plays the last undone move of the running game again (APP-FR-08, issue #178,
// docs/architecture/flows.md, other use cases). It takes the path of `UndoMove` and calls only
// the root, so it never names a variant or a history class (classes.md decisions 4, 27 and 52).
// No exception leaves `execute()`. The failures:
// - `no-running-game`: the repository has no engine.
// - `nothing-to-redo`: the game has no undone move to play again. A variant that never redoes
//   always gives this failure.
// - `redo-failed`: the engine refuses the redo, for example while the game is paused.
// A failure changes nothing. Only a game in play has a move to redo, so the outcome is `playing`.
export class RedoMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<RedoMoveRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(private readonly games: GameRepository<TCell, TCoord, TMove, TState>) {}

  async execute(
    _request: RedoMoveRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = this.games.current();
      if (engine === undefined) {
        return Result.failure(new UseCaseError(FailureCode.noRunningGame, 'No game is running.'));
      }
      if (!engine.canRedo()) {
        return Result.failure(
          new UseCaseError(FailureCode.nothingToRedo, 'No move can be redone.'),
        );
      }
      engine.redo();
      return Result.success(moveResultOf(engine, Outcome.playing));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.redoFailed, thrown));
    }
  }
}
