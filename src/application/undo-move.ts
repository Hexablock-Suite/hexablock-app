import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import { Outcome } from '../domain/engine/outcome';
import { moveResultOf, type MoveResult, type ViewOf } from './move-result';
import { caughtError, Result, UseCaseError } from './result';
import type { RunningGameStore } from './running-game-store';
import type { UseCase } from './use-case';

// The request of `UndoMove`. It has no member: the running game holds the history.
export type UndoMoveRequest = Readonly<Record<string, never>>;

// Takes back the last move of the running game (APP-FR-08, docs/architecture/flows.md flow 4).
// It asks the engine for its undo capability, so it never names a variant or a history class
// (classes.md decision 27). No exception leaves `execute()`. The failures:
// - `no-running-game`: the store has no engine.
// - `no-undo`: the variant has no history.
// - `nothing-to-undo`: the history has no move to give back.
// - `undo-failed`: the engine refuses the undo, for example while the game is paused.
// A failure changes nothing. Only a game in play has a move to undo, so the outcome is `playing`.
export class UndoMove<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements UseCase<UndoMoveRequest, MoveResult<TCell, TCoord, ViewOf<TState>>> {
  constructor(private readonly games: RunningGameStore<TCell, TCoord, TMove, TState>) {}

  async execute(
    _request: UndoMoveRequest,
  ): Promise<Result<MoveResult<TCell, TCoord, ViewOf<TState>>>> {
    try {
      const engine = this.games.current();
      if (engine === undefined) {
        return Result.failure(new UseCaseError('no-running-game', 'No game is running.'));
      }
      const undoable = engine.undoable();
      if (undoable === undefined) {
        return Result.failure(new UseCaseError('no-undo', 'The variant has no undo.'));
      }
      if (!undoable.canUndo()) {
        return Result.failure(new UseCaseError('nothing-to-undo', 'No move can be undone.'));
      }
      undoable.undo();
      return Result.success(moveResultOf(engine, Outcome.playing));
    } catch (thrown) {
      return Result.failure(caughtError('undo-failed', thrown));
    }
  }
}
