/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GameRepository } from '../../src/application/ports/game-repository';
import { RedoMove } from '../../src/application/game/redo-move';
import type { BoardState } from '../../src/domain/engine/board/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { Turns } from '../../src/domain/engine/geometry/turns';
import type { IVariantFactory } from '../../src/domain/engine/factory/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import {
  errorOf,
  gameUseCases,
  type MemoryGameRepository,
  valueOf,
} from '../support/application/game-use-cases';
import { phaseNameOf } from '../support/engine/phase-name';
import { square } from '../support/engine/square-topology';
import { firstMoveOf } from '../support/engine/variant-game';
import { A, B, threeDominoFitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { viewData } from '../support/variants/view-data';
import { repoRoot } from '../support/run-tool';

// Issue #178: `RedoMove` plays the last undone move of the running game again (APP-FR-08,
// docs/architecture/flows.md, classes.md decisions 4 and 27). It calls only the root:
// `GameEngine.canRedo()` and `GameEngine.redo()`.

const placeA = new PlaceFitPiece(A, Turns.of(0), square(0, 0));
const placeB = new PlaceFitPiece(B, Turns.of(0), square(2, 0));

// Starts one game of a factory and returns its use cases.
async function started<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const useCases = gameUseCases(factory);
  valueOf(await useCases.startGame.execute({}));
  return useCases;
}

// The running game in plain facts, so a failed redo can prove that it changed nothing.
function factsOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(games: MemoryGameRepository<TCell, TCoord, TMove, TState>) {
  const engine = games.running();
  const state = engine.snapshot();
  return {
    cells: state.boardCopy().occupiedCells(),
    score: state.scoreSoFar(),
    phase: phaseNameOf(engine.currentPhase()),
    view: viewData(state.view()),
    canUndo: engine.canUndo(),
    canRedo: engine.canRedo(),
  };
}

describe('RedoMove', () => {
  // The check of APP-FR-08: in Fit, undo and then redo give back the same board.
  it('should_give_back_the_answer_after_the_moves_when_fit_moves_are_undone_and_then_redone', async () => {
    const { games, applyMove, undoMove, redoMove } = await started(threeDominoFitFactory());
    valueOf(await applyMove.execute({ move: placeA }));
    const afterSecond = valueOf(await applyMove.execute({ move: placeB }));
    const played = factsOf(games);
    valueOf(await undoMove.execute({}));
    const undone = valueOf(await undoMove.execute({}));

    const firstRedo = valueOf(await redoMove.execute({}));
    const secondRedo = valueOf(await redoMove.execute({}));

    expect([undone.cells, undone.canUndo, undone.canRedo]).toEqual([[], false, true]);
    expect([firstRedo.canUndo, firstRedo.canRedo]).toEqual([true, true]);
    expect(secondRedo).toEqual(afterSecond);
    expect(factsOf(games)).toEqual(played);
  });

  it('should_return_a_nothing_to_redo_failure_and_change_nothing_when_no_move_was_undone', async () => {
    const { games, applyMove, redoMove } = await started(threeDominoFitFactory());
    valueOf(await applyMove.execute({ move: placeA }));
    const before = factsOf(games);

    const error = errorOf(await redoMove.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'nothing-to-redo',
      'No move can be redone.',
      false,
    ]);
    expect(factsOf(games)).toEqual(before);
  });

  it('should_return_a_nothing_to_redo_failure_and_change_nothing_when_a_new_move_follows_the_undo', async () => {
    const { games, applyMove, undoMove, redoMove } = await started(threeDominoFitFactory());
    valueOf(await applyMove.execute({ move: placeA }));
    valueOf(await undoMove.execute({}));
    valueOf(await applyMove.execute({ move: placeB }));
    const before = factsOf(games);

    const error = errorOf(await redoMove.execute({}));

    expect(error.code).toBe('nothing-to-redo');
    expect(factsOf(games)).toEqual(before);
  });

  // Merge undoes one move and never redoes, and Lines has no history (classes.md decision 3).
  it('should_return_a_nothing_to_redo_failure_and_change_nothing_when_the_variant_cannot_redo', async () => {
    const merge = await started(mergeFactory(7));
    valueOf(await merge.applyMove.execute({ move: firstMoveOf(mergeFactory(7)) }));
    valueOf(await merge.undoMove.execute({}));
    const mergeBefore = factsOf(merge.games);
    const lines = await started(linesFactory());
    valueOf(await lines.applyMove.execute({ move: firstMoveOf(linesFactory()) }));
    const linesBefore = factsOf(lines.games);

    const errors = [
      errorOf(await merge.redoMove.execute({})),
      errorOf(await lines.redoMove.execute({})),
    ];

    expect(errors.map((error) => error.code)).toEqual(['nothing-to-redo', 'nothing-to-redo']);
    expect(factsOf(merge.games)).toEqual(mergeBefore);
    expect(factsOf(lines.games)).toEqual(linesBefore);
  });

  it('should_return_a_no_running_game_failure_when_the_repository_has_no_game', async () => {
    const { redoMove } = gameUseCases(threeDominoFitFactory());

    const error = errorOf(await redoMove.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'no-running-game',
      'No game is running.',
      false,
    ]);
  });

  it('should_return_a_redo_failed_failure_and_change_nothing_when_the_game_is_paused', async () => {
    const { games, applyMove, undoMove, redoMove } = await started(threeDominoFitFactory());
    valueOf(await applyMove.execute({ move: placeA }));
    valueOf(await undoMove.execute({}));
    games.running().pause();
    const before = factsOf(games);

    const error = errorOf(await redoMove.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'redo-failed',
      'The game cannot accept an undo in the paused phase.',
      false,
    ]);
    expect(factsOf(games)).toEqual(before);
  });

  it('should_return_a_redo_failed_failure_when_the_repository_throws', async () => {
    const repository = {
      current: () => {
        throw new Error('The repository cannot read.');
      },
      replace: () => undefined,
    } as unknown as GameRepository<unknown, unknown, unknown, never>;

    const error = errorOf(await new RedoMove(repository).execute({}));

    expect([error.code, error.message]).toEqual(['redo-failed', 'The repository cannot read.']);
  });

  it('should_name_no_variant_and_no_history_when_its_source_is_read', () => {
    const source = readFileSync(join(repoRoot, 'src/application/game/redo-move.ts'), 'utf8');

    expect(source).not.toMatch(/hexa-|domain\/variants|Lines|Fit|Sort|Merge|History/);
  });
});
