/** @jest-environment node */
import { GameProgress } from '../../../src/domain/progress/game-progress';
import { LevelId } from '../../../src/domain/progress/level-id';
import { ProgressRecord } from '../../../src/domain/progress/progress-model';
import { Stars } from '../../../src/domain/progress/stars';
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import { GameId } from '../../../src/domain/shared/game-id';
import { Moves } from '../../../src/domain/shared/moves';
import { Score } from '../../../src/domain/shared/score';
import { contentOf } from '../../support/engine/progress-content';

// Issue #46 (APP-FR-13, D27): the sync merges the answer of the backend into the local progress,
// and the progress played with no account merges into the first account that signs in.
// `mergeWith()` keeps the best of the two progresses by the rule of DS-12. A tie keeps the record
// of the progress that merges, because a tie keeps the stored record.

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');
const highScore = (score: number) => ProgressRecord.of({ gameId: LINES, score: Score.of(score) });
const levelRecord = (level: string, stars: number, moves: number, ms: number, score = 0) =>
  ProgressRecord.of({
    gameId: FIT,
    score: Score.of(score),
    levelId: LevelId.of(level),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ElapsedTime.ofMs(ms),
  });

function linesWith(score: number | undefined): GameProgress {
  const progress = GameProgress.start(LINES);
  if (score !== undefined) progress.recordScore(highScore(score));
  return progress;
}

function fitWith(...records: ProgressRecord[]): GameProgress {
  const progress = GameProgress.start(FIT);
  for (const record of records) progress.recordLevel(record);
  return progress;
}

describe('GameProgress.mergeWith', () => {
  it('should_keep_the_higher_high_score_when_a_progress_merges_another_progress_of_its_game', () => {
    const lower = linesWith(20);
    const higher = linesWith(36);
    const none = linesWith(undefined);

    lower.mergeWith(linesWith(36));
    higher.mergeWith(linesWith(20));
    none.mergeWith(linesWith(12));

    expect(lower.keeps(highScore(36))).toBe(true);
    expect(higher.keeps(highScore(36))).toBe(true);
    expect(higher.keeps(highScore(20))).toBe(false);
    expect(none.keeps(highScore(12))).toBe(true);
  });

  it('should_keep_the_best_result_of_each_level_when_a_progress_merges_another_progress_of_its_game', () => {
    const local = fitWith(
      levelRecord('fit-01', 2, 12, 9000, 40),
      levelRecord('fit-02', 3, 9, 5000),
    );
    const remote = fitWith(
      levelRecord('fit-01', 3, 20, 9000),
      levelRecord('fit-02', 3, 9, 7000),
      levelRecord('fit-03', 1, 30, 4000),
    );

    local.mergeWith(remote);

    const levels = contentOf(local).levels;
    expect(levels).toHaveLength(3);
    expect(local.keeps(levelRecord('fit-01', 3, 20, 9000))).toBe(true);
    expect(local.keeps(levelRecord('fit-02', 3, 9, 5000))).toBe(true);
    expect(local.keeps(levelRecord('fit-03', 1, 30, 4000))).toBe(true);
    expect(local.keeps(levelRecord('fit-01', 2, 12, 9000, 40))).toBe(false);
  });

  // DS-12: a full tie keeps the stored record, so the local score of a level stays.
  it('should_keep_its_own_record_when_the_other_progress_holds_a_full_tie_of_a_level', () => {
    const local = fitWith(levelRecord('fit-01', 2, 12, 9000, 40));

    local.mergeWith(fitWith(levelRecord('fit-01', 2, 12, 9000, 0)));

    expect(local.keeps(levelRecord('fit-01', 2, 12, 9000, 40))).toBe(true);
    expect(contentOf(local).levels).toHaveLength(1);
  });

  it('should_leave_the_other_progress_as_it_was_when_a_progress_merges_it', () => {
    const local = fitWith(levelRecord('fit-01', 3, 5, 1000));
    const remote = fitWith(levelRecord('fit-01', 1, 30, 9000));

    local.mergeWith(remote);

    expect(remote.keeps(levelRecord('fit-01', 1, 30, 9000))).toBe(true);
    expect(contentOf(remote).levels).toHaveLength(1);
  });

  it('should_throw_a_range_error_and_change_nothing_when_the_other_progress_is_of_another_game', () => {
    const local = fitWith(levelRecord('fit-01', 2, 12, 9000));

    expect(() => local.mergeWith(linesWith(36))).toThrow(
      new RangeError('A progress merges only a progress of its own game.'),
    );
    expect(contentOf(local).highScore).toBeUndefined();
    expect(contentOf(local).levels).toHaveLength(1);
  });
});
