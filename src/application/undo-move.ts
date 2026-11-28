import type { BoardState } from '../domain/engine/board/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import { Outcome } from '../domain/engine/events/outcome';
import type { GameRepository } from './game-repository';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, FailureCode, Result, UseCaseError } from './result';
import type { UseCase } from './use-case';

// The request of `UndoMove`. It has no member: the running game holds the history.
export type UndoMoveRequest = Readonly<Record<string, never>>;

// Takes back the last move of the running game (APP-FR-08, docs/architecture/flows.md flow 4).
// It calls only the root, so it never names a variant, a history or a history class
// (classes.md decisions 27 and 52, issue #234). No exception leaves `execute()`. The failures:
// - `no-running-game`: the repository has no engine.
// - `no-undo`: the variant offers no undo.
// - `nothing-to-undo`: the history has no move to give back.
// - `undo-failed`: the engine refuses the undo, for example while the game is paused.
// A failure changes nothing. Only a game in play has a move to undo, so the outcome is `playing`.
export class UndoMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<UndoMoveRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(private readonly games: GameRepository<TCell, TCoord, TMove, TState>) {}

  async execute(
    _request: UndoMoveRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = this.games.current();
      if (engine === undefined) {
        return Result.failure(new UseCaseError(FailureCode.noRunningGame, 'No game is running.'));
      }
      if (!engine.offersUndo()) {
        return Result.failure(new UseCaseError(FailureCode.noUndo, 'The variant has no undo.'));
      }
      if (!engine.canUndo()) {
        return Result.failure(
          new UseCaseError(FailureCode.nothingToUndo, 'No move can be undone.'),
        );
      }
      engine.undo();
      return Result.success(moveResultOf(engine, Outcome.playing));
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.undoFailed, thrown));
    }
  }
}
