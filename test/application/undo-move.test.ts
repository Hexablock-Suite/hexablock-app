/** @jest-environment node */
import { Outcome } from '../../src/domain/engine/outcome';
import { phaseNameOf } from '../support/engine/phase-name';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { GameRepository } from '../../src/application/game-repository';
import { Result } from '../../src/application/result';
import { SaveProgress } from '../../src/application/save-progress';
import { UndoMove } from '../../src/application/undo-move';
import type { BoardState } from '../../src/domain/engine/board-state';
import { GameId } from '../../src/domain/shared/game-id';
import type { HexCoord } from '../../src/domain/engine/hex-topology';
import { Moves } from '../../src/domain/shared/moves';
import { GameResult, ProgressRecord } from '../../src/domain/progress/progress-model';
import type { Score } from '../../src/domain/shared/score';
import type { MergeFactory } from '../../src/domain/variants/hexa-merge/merge-factory';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { RecordingPublisher } from '../support/application/recording-publisher';
import { dataOf, gameOversIn } from '../support/engine/game-over';
import { PlayingPhase } from '../../src/domain/engine/game-phase';
import type { IPieceSource } from '../../src/domain/engine/piece-source';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { MatchId } from '../../src/domain/engine/match-id';
import { Turns } from '../../src/domain/engine/turns';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import type { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import type { NewTile } from '../../src/domain/variants/hexa-merge/new-tile';
import {
  errorOf,
  gameUseCases,
  type MemoryGameRepository,
  valueOf,
} from '../support/application/game-use-cases';
import { firstMoveOf, firstValidMove } from '../support/engine/variant-game';
import { square } from '../support/engine/square-topology';
import { A, B, threeDominoFitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory, mergeStateOf } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';
import { viewData } from '../support/variants/view-data';
import { repoRoot } from '../support/run-tool';

// `UndoMove` takes back the last move of a variant that has a history (issue 159, APP-FR-08,
// docs/architecture/flows.md use case 4, classes.md decisions 27 and 34).

const placeA = new PlaceFitPiece(A, Turns.of(0), square(0, 0));
const placeB = new PlaceFitPiece(B, Turns.of(0), square(2, 0));

// The match of the first game that `gameUseCases()` starts: its generator counts from 1.
const FIRST_MATCH = MatchId.of('match-1');

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
>(games: MemoryGameRepository<TCell, TCoord, TMove, TState>) {
  const engine = games.running();
  const state = engine.snapshot();
  return {
    cells: state.boardCopy().occupiedCells(),
    score: state.scoreSoFar(),
    phase: phaseNameOf(engine.currentPhase()),
    view: viewData(state.view()),
  };
}

// The next draws of a seeded source. The read is pure, so the source stays where it is.
// A `toEqual` on the source itself would never end, because the source is an endless iterator.
// A draw keeps its fields private (issue 210), so the list holds the draws themselves,
// and `toEqual` compares two draws by their fields.
function drawsOf(source: IPieceSource<NewTile<MergeTile>>): NewTile<MergeTile>[] {
  const draws: NewTile<MergeTile>[] = [];
  for (const draw of source) {
    draws.push(draw);
    if (draws.length === 8) break;
  }
  return draws;
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
      freeSpaces: afterFirst.freeSpaces,
      score: afterFirst.score,
      outcome: Outcome.playing,
      canUndo: true,
      // Since #178 Fit redoes: the undone move can be played again.
      canRedo: true,
      hasUndo: true,
      payload: afterFirst.payload,
      // Fit is timed, and this clock does not move.
      elapsedMs: ElapsedTime.ofMs(0),
      // Fit counts its moves (D26, #180). The undo takes back the count of the second move.
      moves: afterFirst.moves,
    });
    expect(games.running().snapshot().boardCopy().occupiedCells()).toEqual(afterFirst.cells);
    expect(games.running().currentPhase()).toBe(PlayingPhase.instance);
  });

  // Issue #234: `UndoMove` and `moveResultOf()` call only the root. The response keeps its shape.
  it('should_give_the_fields_and_values_of_the_start_when_the_only_fit_move_is_undone', async () => {
    const useCases = gameUseCases(threeDominoFitFactory());
    const start = valueOf(await useCases.startGame.execute({}));
    valueOf(await useCases.applyMove.execute({ move: placeA }));

    const undone = valueOf(await useCases.undoMove.execute({}));

    // Since #178 Fit redoes, so only the redo flag differs from the start.
    expect(undone).toEqual({ ...start, canRedo: true });
    expect(Object.keys(undone).sort()).toEqual([
      'canRedo',
      'canUndo',
      'cells',
      'elapsedMs',
      'freeSpaces',
      'hasUndo',
      'moves',
      'outcome',
      'payload',
      'score',
    ]);
    expect([undone.canUndo, undone.canRedo, undone.hasUndo]).toEqual([false, true, true]);
  });

  it('should_give_back_the_same_source_position_when_a_variant_with_a_random_source_undoes_a_move', async () => {
    const factory = mergeFactory(7);
    const { games, applyMove, undoMove } = await started(factory);
    const before = games.running().snapshot();
    const slide = firstValidMove(factory.createRules(), mergeStateOf(before, FIRST_MATCH));
    const firstPlay = valueOf(await applyMove.execute({ move: slide }));
    const afterPlay = games.running().snapshot();

    const undone = valueOf(await undoMove.execute({}));
    const after = games.running().snapshot();
    const replay = valueOf(await applyMove.execute({ move: slide }));

    // The move drew a tile, so the source moved. The undo puts the source back (S3-15).
    expect(drawsOf(afterPlay.tileSource())).not.toEqual(drawsOf(before.tileSource()));
    expect(drawsOf(after.tileSource())).toEqual(drawsOf(before.tileSource()));
    expect(undone.cells).toEqual(before.boardCopy().occupiedCells());
    expect([undone.score, undone.outcome]).toEqual([before.scoreSoFar(), Outcome.playing]);
    // The same slide draws the same new tile again.
    expect(replay.cells).toEqual(firstPlay.cells);
    expect(replay.score).toEqual(firstPlay.score);
  });

  // Issue #179 (APP-FR-08): the undo gives back the photo before the slide, points included.
  // So the final score of the game, which `SaveProgress` keeps as the high score of Merge,
  // does not count the undone slide. The same seed plays the same game with no undo.
  it('should_save_a_high_score_without_the_points_of_the_undone_slide_when_a_merge_game_ends_after_an_undo', async () => {
    const factory = mergeFactory(7);
    const withUndo = await playToTheEnd(factory, true);
    const withoutUndo = await playToTheEnd(factory, false);
    const store = new InMemoryKeyValueStore();
    const save = new SaveProgress(
      new LocalProgressRepository(store),
      factory.createProgressModel(),
      MERGE,
    );

    const saved = await save.execute(
      GameResult.of({ gameId: MERGE, score: withUndo.finalScore, moves: withUndo.kept }),
    );
    const progress = await new LocalProgressRepository(store).load(MERGE);

    // The undone slide scored, and the undo took its points back.
    expect(withUndo.undone?.after.isHigherThan(withUndo.undone.before)).toBe(true);
    expect(withUndo.undone?.undone).toEqual(withUndo.undone?.before);
    expect(withUndo.finalScore).toEqual(withoutUndo.finalScore);
    expect(withUndo.kept).toEqual(withoutUndo.kept);
    expect(saved).toEqual(Result.success(undefined));
    expect(
      progress?.keeps(ProgressRecord.of({ gameId: MERGE, score: withoutUndo.finalScore })),
    ).toBe(true);
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

  it('should_return_a_no_running_game_failure_when_the_repository_has_no_game', async () => {
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
    const slide = firstMoveOf(factory);
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
      const move = firstValidMove(
        factory.createRules(),
        mergeStateOf(games.running().snapshot(), FIRST_MATCH),
      );
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

  it('should_return_an_undo_failed_failure_when_the_repository_throws', async () => {
    const repository = {
      current: () => {
        throw new Error('The repository cannot read.');
      },
      replace: () => undefined,
    } as unknown as GameRepository<unknown, unknown, unknown, never>;

    const error = errorOf(await new UndoMove(repository).execute({}));

    expect([error.code, error.message]).toEqual(['undo-failed', 'The repository cannot read.']);
  });
});

// The id of Hexa Merge, which `SaveProgress` takes from the composition root.
const MERGE = GameId.of('hexa-merge');

// The most turns of one Merge game on a hexagon of 2 rings. The game ends long before.
const MOST_TURNS = 500;

// One Merge game through the use cases, from its start to its `GameOver` event.
// Each turn plays the first valid slide. With `undoOnce`, the game undoes the first slide
// that scores, once, and goes on. It gives the score before that slide, the score after it
// and the score after the undo, the final score of the event and the count of kept slides.
async function playToTheEnd(factory: MergeFactory<HexCoord>, undoOnce: boolean) {
  const events = new RecordingPublisher();
  const { games, startGame, applyMove, undoMove } = gameUseCases(factory, events);
  let score = valueOf(await startGame.execute({})).score;
  let kept = 0;
  let undone: { before: Score; after: Score; undone: Score } | undefined;
  for (let turn = 0; gameOversIn(events.events).length === 0; turn += 1) {
    if (turn === MOST_TURNS) throw new RangeError('The Merge game did not end.');
    const slide = firstValidMove(
      factory.createRules(),
      mergeStateOf(games.running().snapshot(), FIRST_MATCH),
    );
    const played = valueOf(await applyMove.execute({ move: slide }));
    kept += 1;
    if (undoOnce && undone === undefined && played.canUndo && played.score.isHigherThan(score)) {
      const back = valueOf(await undoMove.execute({}));
      undone = { before: score, after: played.score, undone: back.score };
      kept -= 1;
      score = back.score;
    } else {
      score = played.score;
    }
  }
  const [ended] = gameOversIn(events.events);
  return { undone, finalScore: dataOf(ended).finalScore, kept: Moves.of(kept) };
}

// One game of a variant with no history: its first move, a refused undo and the facts around it.
async function noHistoryRun<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, applyMove, undoMove } = await started(factory);
  const move = firstMoveOf(factory);
  valueOf(await applyMove.execute({ move }));
  const before = factsOf(games);
  const error = errorOf(await undoMove.execute({}));
  const { code, message, retryable } = error;
  return { code, message, retryable, before, after: factsOf(games) };
}
