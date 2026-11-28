/** @jest-environment node */
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { Result } from '../../src/application/result';
import { SaveProgress } from '../../src/application/progress/save-progress';
import { BoardShape } from '../../src/domain/engine/geometry/board-shape';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { LevelId } from '../../src/domain/progress/level-id';
import { Moves } from '../../src/domain/shared/moves';
import { Piece } from '../../src/domain/engine/board/piece';
import { GameResult, ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { CellNode, ShapeGroup } from '../../src/domain/engine/geometry/shape-node';
import { SquareGeometry } from '../../src/domain/engine/geometry/square-geometry';
import { Stars } from '../../src/domain/progress/stars';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../../src/domain/variants/hexa-fit/fit-level';
import { FitStarThreshold } from '../../src/domain/variants/hexa-fit/fit-stars';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { sameContent } from '../support/engine/progress-content';
import { ManualClock } from '../support/engine/manual-clock';
import { square } from '../support/engine/square-topology';
import { A } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { ProgressOwner } from '../../src/application/ports/progress-owner';

// `SaveProgress` records a `GameResult` in the progress of its game with the progress model
// of the variant, and saves the progress through the `ProgressRepository` port (issue #164).
// The tests run the real `LocalProgressRepository` over the in-memory `KeyValueStore`,
// as the integration tests of APP-NFR-15 do.

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');
const SORT = GameId.of('hexa-sort');
const MERGE = GameId.of('hexa-merge');

// A Fit level of one domino with two star thresholds: one move in 5 s or less gives one star,
// and one move in 2 s or less gives the second star (D22).
function fitWithStars(): FitFactory<ReturnType<typeof square>> {
  const domino = new Piece(
    new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]),
    A,
  );
  const star = (maxMoves: number, maxMs: number) =>
    FitStarThreshold.of({ maxMoves: Moves.of(maxMoves), maxElapsedMs: ElapsedTime.ofMs(maxMs) });
  return new FitFactory(
    new SquareGeometry(),
    FitLevel.of(
      TopologyId.square,
      BoardShape.of([square(0, 0), square(1, 0)]),
      [domino],
      [star(1, 5000), star(1, 2000)],
    ),
    new ManualClock(),
  );
}

// The result of one play of the Fit level `fit-01`.
const fitPlay = (moves: number, ms: number) =>
  GameResult.of({
    gameId: FIT,
    score: Score.of(0),
    moves: Moves.of(moves),
    levelId: LevelId.of('fit-01'),
    elapsedMs: ElapsedTime.ofMs(ms),
  });
// The record that the Fit progress keeps for one play of `fit-01`.
const fitRecord = (stars: number, moves: number, ms: number) =>
  ProgressRecord.of({
    gameId: FIT,
    score: Score.of(0),
    levelId: LevelId.of('fit-01'),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ElapsedTime.ofMs(ms),
  });
const linesPlay = (score: number) =>
  GameResult.of({ gameId: LINES, score: Score.of(score), moves: Moves.of(4) });
const linesRecord = (score: number) => ProgressRecord.of({ gameId: LINES, score: Score.of(score) });

// The use cases of the two games over one store.
function useCases(store: InMemoryKeyValueStore) {
  const repository = new LocalProgressRepository(store);
  return {
    saveFit: new SaveProgress(repository, fitWithStars().createProgressModel(), FIT),
    saveLines: new SaveProgress(repository, linesFactory().createProgressModel(), LINES),
  };
}

// A store that refuses every save with `error`.
class RefusingStore extends InMemoryKeyValueStore {
  constructor(private readonly error: Error) {
    super();
  }

  override set(): Promise<void> {
    return Promise.reject(this.error);
  }
}

describe('SaveProgress', () => {
  // Done when of issue #164: a test saves a Fit level result and a Lines high score,
  // and loads both back. Each loaded value object equals the saved one.
  it('should_load_back_the_fit_level_result_and_the_lines_high_score_when_both_are_saved', async () => {
    const store = new InMemoryKeyValueStore();
    const { saveFit, saveLines } = useCases(store);
    const expectedFit = GameProgress.start(FIT);
    expectedFit.recordLevel(fitRecord(1, 1, 3000));
    const expectedLines = GameProgress.start(LINES);
    expectedLines.recordScore(linesRecord(36));

    const results = [
      await saveFit.execute(fitPlay(1, 3000)),
      await saveLines.execute(linesPlay(36)),
    ];
    // A new repository over the same store reads the progress, as after a restart.
    const restarted = new LocalProgressRepository(store);
    const fit = await restarted.load(ProgressOwner.anonymous, FIT);
    const lines = await restarted.load(ProgressOwner.anonymous, LINES);

    expect(results).toEqual([Result.success(undefined), Result.success(undefined)]);
    expect(fit?.keeps(fitRecord(1, 1, 3000))).toBe(true);
    expect(lines?.keeps(linesRecord(36))).toBe(true);
    expect(fit !== undefined && sameContent(fit, expectedFit)).toBe(true);
    expect(lines !== undefined && sameContent(lines, expectedLines)).toBe(true);
  });

  // Done when of issue #164: a worse result does not replace the stored best one (DS-4, DS-12).
  it('should_keep_the_stored_best_result_when_a_worse_result_is_saved', async () => {
    const store = new InMemoryKeyValueStore();
    const { saveFit, saveLines } = useCases(store);

    await saveFit.execute(fitPlay(1, 3000));
    await saveLines.execute(linesPlay(36));
    const results = [
      await saveFit.execute(fitPlay(2, 1000)),
      await saveLines.execute(linesPlay(20)),
    ];
    const fit = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT);
    const lines = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, LINES);

    expect(results).toEqual([Result.success(undefined), Result.success(undefined)]);
    // Two moves win no star, so the stored play with one star stays.
    expect(fit?.keeps(fitRecord(1, 1, 3000))).toBe(true);
    expect(fit?.keeps(fitRecord(0, 2, 1000))).toBe(false);
    expect(lines?.keeps(linesRecord(36))).toBe(true);
    expect(lines?.keeps(linesRecord(20))).toBe(false);
  });

  it('should_replace_the_stored_result_when_a_better_result_is_saved', async () => {
    const store = new InMemoryKeyValueStore();
    const { saveFit, saveLines } = useCases(store);

    await saveFit.execute(fitPlay(1, 3000));
    await saveLines.execute(linesPlay(36));
    await saveFit.execute(fitPlay(1, 1000));
    await saveLines.execute(linesPlay(40));
    const fit = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT);
    const lines = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, LINES);

    expect(fit?.keeps(fitRecord(2, 1, 1000))).toBe(true);
    expect(fit?.keeps(fitRecord(1, 1, 3000))).toBe(false);
    expect(lines?.keeps(linesRecord(40))).toBe(true);
    expect(lines?.keeps(linesRecord(36))).toBe(false);
  });

  // No exception leaves `execute()` (decision 28).
  it('should_give_a_save_failed_failure_and_save_nothing_when_the_store_refuses_the_save', async () => {
    const refusal = new Error('The device storage is full.');
    const store = new RefusingStore(refusal);

    const result = await useCases(store).saveLines.execute(linesPlay(36));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect([result.error.code, result.error.message, result.error.retryable]).toEqual([
      'save-failed',
      'The device storage is full.',
      false,
    ]);
    expect(result.error.cause).toBe(refusal);
    await expect(store.get('progress:hexa-lines')).resolves.toBeUndefined();
  });

  // The use case never writes over a saved progress that it cannot read.
  it('should_give_a_save_failed_failure_and_keep_the_saved_text_when_the_saved_progress_is_not_valid', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('progress:hexa-lines', '{"version":2}');

    const result = await useCases(store).saveLines.execute(linesPlay(36));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('save-failed');
    expect(result.error.cause).toBeInstanceOf(RangeError);
    await expect(store.get('progress:hexa-lines')).resolves.toBe('{"version":2}');
  });

  // Issue #372: the progress of a game refuses a result of another game. So the use case
  // gives a `save-failed` failure before it saves anything, and the store keeps its progress.
  it('should_give_a_save_failed_failure_and_keep_the_stored_progress_when_the_result_is_of_another_game', async () => {
    const store = new InMemoryKeyValueStore();
    const { saveFit, saveLines } = useCases(store);
    await saveFit.execute(fitPlay(1, 3000));
    await saveLines.execute(linesPlay(36));
    const savedFit = await store.get('progress:hexa-fit');
    const savedLines = await store.get('progress:hexa-lines');
    // A Sort play of a level with the id of the Fit level, and a Merge score with no level id.
    const sortPlay = GameResult.of({
      gameId: SORT,
      score: Score.of(0),
      moves: Moves.of(1),
      levelId: LevelId.of('fit-01'),
      elapsedMs: ElapsedTime.ofMs(1000),
    });
    const mergePlay = GameResult.of({ gameId: MERGE, score: Score.of(900), moves: Moves.of(4) });

    const results = [await saveFit.execute(sortPlay), await saveLines.execute(mergePlay)];
    const fit = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT);
    const lines = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, LINES);

    expect(results.map((result) => (result.ok ? 'success' : result.error.code))).toEqual([
      'save-failed',
      'save-failed',
    ]);
    expect(
      results.map((result) => (result.ok ? undefined : result.error.cause instanceof RangeError)),
    ).toEqual([true, true]);
    await expect(store.get('progress:hexa-fit')).resolves.toBe(savedFit);
    await expect(store.get('progress:hexa-lines')).resolves.toBe(savedLines);
    expect(fit?.keeps(fitRecord(1, 1, 3000))).toBe(true);
    expect(fit?.keeps(fitRecord(2, 1, 1000))).toBe(false);
    expect(lines?.keeps(linesRecord(36))).toBe(true);
    expect(lines?.keeps(linesRecord(900))).toBe(false);
  });
});
