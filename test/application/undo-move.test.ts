/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunningGameStore } from '../../src/application/running-game-store';
import { UndoMove } from '../../src/application/undo-move';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import type { IPieceSource } from '../../src/domain/engine/piece-source';
import { Turns } from '../../src/domain/engine/turns';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import type { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import type { NewTile } from '../../src/domain/variants/hexa-merge/new-tile';
import {
  errorOf,
  gameUseCases,
  type MemoryRunningGameStore,
  valueOf,
} from '../support/application/game-use-cases';
import { firstValidMove } from '../support/engine/variant-game';
import { square } from '../support/engine/square-topology';
import { A, B, threeDominoFitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';
import { repoRoot } from '../support/run-tool';

// `UndoMove` takes back the last move of a variant that has a history (issue 159, APP-FR-08,
// docs/architecture/flows.md use case 4, classes.md decisions 27 and 34).

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

// The running game in plain facts, so a failed undo can prove that it changed nothing.
function factsOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(games: MemoryRunningGameStore<TCell, TCoord, TMove, TState>) {
  const engine = games.running();
  const state = engine.snapshot();
  return {
    cells: state.board.cells(),
    score: state.score,
    phase: engine.phase.name,
    view: state.view(),
  };
}

// The next draws of a seeded source. They read a clone, so the source stays where it is.
// A `toEqual` on the source itself would never end, because the source is an endless iterator.
function drawsOf(source: IPieceSource<NewTile<MergeTile>>): [number, number][] {
  const copy = source.clone();
  return Array.from({ length: 8 }, () => {
    const draw = copy.next();
    return [draw.place, draw.tile.value];
  });
}

describe('UndoMove', () => {
  it('should_give_back_the_board_after_the_first_move_when_two_moves_are_played_and_one_is_undone', async () => {
    const { games, applyMove, undoMove } = await started(threeDominoFitFactory());
    const afterFirst = valueOf(await applyMove.execute({ move: placeA }));
    const afterSecond = valueOf(await applyMove.execute({ move: placeB }));

    const undone = valueOf(await undoMove.execute({}));

    expect(afterSecond.cells).not.toEqual(afterFirst.cells);
    expect(undone).toEqual({
      cells: afterFirst.cells,
      score: afterFirst.score,
      outcome: 'playing',
      canUndo: true,
      canRedo: false,
      hasUndo: true,
      payload: afterFirst.payload,
    });
    expect(games.running().snapshot().board.cells()).toEqual(afterFirst.cells);
    expect(games.running().phase.name).toBe('playing');
  });

  it('should_give_back_the_same_source_position_when_a_variant_with_a_random_source_undoes_a_move', async () => {
    const factory = mergeFactory(7);
    const { games, applyMove, undoMove } = await started(factory);
    const before = games.running().snapshot();
    const slide = firstValidMove(factory.createRules(), before);
    const firstPlay = valueOf(await applyMove.execute({ move: slide }));
    const afterPlay = games.running().snapshot();

    const undone = valueOf(await undoMove.execute({}));
    const after = games.running().snapshot();
    const replay = valueOf(await applyMove.execute({ move: slide }));

    // The move drew a tile, so the source moved. The undo puts the source back (S3-15).
    expect(drawsOf(afterPlay.tiles)).not.toEqual(drawsOf(before.tiles));
    expect(drawsOf(after.tiles)).toEqual(drawsOf(before.tiles));
    expect(undone.cells).toEqual(before.board.cells());
    expect([undone.score, undone.outcome]).toEqual([before.score, 'playing']);
    // The same slide draws the same new tile again.
    expect(replay.cells).toEqual(firstPlay.cells);
    expect(replay.score).toBe(firstPlay.score);
  });

  it('should_return_a_failure_and_change_nothing_when_the_variant_has_no_history', async () => {
    const runs = [await noHistoryRun(linesFactory()), await noHistoryRun(sortFactory())];

    for (const run of runs) {
      expect(run.code).toBe('no-undo');
      expect(run.message).toBe('The variant has no undo.');
      expect(run.retryable).toBe(false);
      expect(run.after).toEqual(run.before);
    }
  });

  it('should_name_no_variant_when_its_source_is_read', () => {
    const source = readFileSync(join(repoRoot, 'src/application/undo-move.ts'), 'utf8');

    expect(source).not.toMatch(/hexa-|domain\/variants|Lines|Fit|Sort|Merge/);
  });

  it('should_return_a_no_running_game_failure_when_the_store_has_no_game', async () => {
    const { undoMove } = gameUseCases(mergeFactory());

    const error = errorOf(await undoMove.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'no-running-game',
      'No game is running.',
      false,
    ]);
  });

  it('should_return_a_failure_and_change_nothing_when_no_move_can_be_undone', async () => {
    const factory = mergeFactory(7);
    const { games, applyMove, undoMove } = await started(factory);

    const atStart = errorOf(await undoMove.execute({}));
    const start = factsOf(games);
    const slide = firstValidMove(factory.createRules(), games.running().snapshot());
    valueOf(await applyMove.execute({ move: slide }));
    const undone = valueOf(await undoMove.execute({}));
    const beforeSecond = factsOf(games);
    const second = errorOf(await undoMove.execute({}));

    expect([atStart.code, atStart.message]).toEqual(['nothing-to-undo', 'No move can be undone.']);
    expect(second.code).toBe('nothing-to-undo');
    expect(factsOf(games)).toEqual(beforeSecond);
    expect(factsOf(games)).toEqual(start);
    expect(undone.canUndo).toBe(false);
  });

  it('should_undo_one_move_only_when_the_history_keeps_one_move', async () => {
    const factory = mergeFactory(7);
    const { games, applyMove, undoMove } = await started(factory);
    const play = async () => {
      const move = firstValidMove(factory.createRules(), games.running().snapshot());
      valueOf(await applyMove.execute({ move }));
    };
    await play();
    const afterFirst = factsOf(games);
    await play();

    const undone = valueOf(await undoMove.execute({}));
    const second = errorOf(await undoMove.execute({}));

    expect(factsOf(games)).toEqual(afterFirst);
    expect([undone.canUndo, second.code]).toEqual([false, 'nothing-to-undo']);
  });

  it('should_undo_every_move_when_the_history_has_no_limit', async () => {
    const { games, applyMove, undoMove } = await started(threeDominoFitFactory());
    const start = factsOf(games);
    valueOf(await applyMove.execute({ move: placeA }));
    valueOf(await applyMove.execute({ move: placeB }));

    valueOf(await undoMove.execute({}));
    const last = valueOf(await undoMove.execute({}));

    expect(factsOf(games)).toEqual(start);
    expect(last.canUndo).toBe(false);
  });

  it('should_return_an_undo_failed_failure_and_change_nothing_when_the_game_is_paused', async () => {
    const { games, applyMove, undoMove } = await started(threeDominoFitFactory());
    valueOf(await applyMove.execute({ move: placeA }));
    games.running().pause();
    const before = factsOf(games);

    const error = errorOf(await undoMove.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'undo-failed',
      'The game cannot accept an undo in the paused phase.',
      false,
    ]);
    expect(factsOf(games)).toEqual(before);
  });

  it('should_return_an_undo_failed_failure_when_the_store_throws', async () => {
    const store = {
      current: () => {
        throw new Error('The store cannot read.');
      },
      replace: () => undefined,
    } as unknown as RunningGameStore<unknown, unknown, unknown, never>;

    const error = errorOf(await new UndoMove(store).execute({}));

    expect([error.code, error.message]).toEqual(['undo-failed', 'The store cannot read.']);
  });
});

// One game of a variant with no history: its first move, a refused undo and the facts around it.
async function noHistoryRun<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, applyMove, undoMove } = await started(factory);
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
  valueOf(await applyMove.execute({ move }));
  const before = factsOf(games);
  const error = errorOf(await undoMove.execute({}));
  const { code, message, retryable } = error;
  return { code, message, retryable, before, after: factsOf(games) };
}
