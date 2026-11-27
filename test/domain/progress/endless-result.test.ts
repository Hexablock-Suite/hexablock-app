/** @jest-environment node */
import { GameProgress } from '../../../src/domain/progress/game-progress';
import { HighScoreProgress } from '../../../src/domain/progress/high-score-progress';
import { LevelId } from '../../../src/domain/progress/level-id';
import { LevelProgress } from '../../../src/domain/progress/level-progress';
import { GameResult, ProgressRecord } from '../../../src/domain/progress/progress-model';
import { Stars } from '../../../src/domain/progress/stars';
import { GameId } from '../../../src/domain/shared/game-id';
import { Moves } from '../../../src/domain/shared/moves';
import { Score } from '../../../src/domain/shared/score';

// Issue #180 (decision 61, D26): `GameResult` has a second way to build. An endless result
// takes the game and the score only, because Lines and Merge count no moves.

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');

// A star rule that gives one star to every play.
const oneStar = { starsFor: () => Stars.of(1) };

describe('an endless GameResult', () => {
  it('should_record_the_score_as_the_high_score_when_a_model_with_no_levels_records_an_endless_result', () => {
    const progress = GameProgress.start(LINES);

    new HighScoreProgress().record(
      GameResult.endless({ gameId: LINES, score: Score.of(40) }),
      progress,
    );

    expect(progress.keeps(ProgressRecord.of({ gameId: LINES, score: Score.of(40) }))).toBe(true);
  });

  it('should_equal_only_an_endless_result_of_the_same_game_and_score_when_two_results_are_compared', () => {
    const endless = GameResult.endless({ gameId: LINES, score: Score.of(40) });

    expect(endless.equals(GameResult.endless({ gameId: LINES, score: Score.of(40) }))).toBe(true);
    expect(endless.equals(GameResult.endless({ gameId: LINES, score: Score.of(41) }))).toBe(false);
    expect(
      endless.equals(GameResult.of({ gameId: LINES, score: Score.of(40), moves: Moves.of(0) })),
    ).toBe(false);
  });

  // An endless result has no moves, so no star rule can count it. The progress stays as it was.
  it('should_throw_a_range_error_and_keep_the_progress_when_a_level_model_records_an_endless_result', () => {
    const progress = GameProgress.start(FIT);

    const endless = GameResult.endless({ gameId: FIT, score: Score.of(0) });
    const refusal = new RangeError('An endless result has no moves, so no level counts its stars.');

    expect(() => LevelProgress.byMoves(oneStar).record(endless, progress)).toThrow(refusal);
    expect(() => LevelProgress.byMovesAndTime(oneStar).record(endless, progress)).toThrow(refusal);
    expect(progress.starsOf(LevelId.of('fit-01'))).toBeUndefined();
  });
});
