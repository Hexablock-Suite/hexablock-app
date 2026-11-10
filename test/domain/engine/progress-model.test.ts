/** @jest-environment node */
import { GameId } from '../../../src/domain/engine/game-id';
import { GameResult, ProgressRecord } from '../../../src/domain/engine/progress-model';
import { Score } from '../../../src/domain/engine/score';

// A progress record holds a `Score` and finite stars. Stars stay decimal: no requirement says
// that stars are whole numbers.
describe('ProgressRecord', () => {
  const gameId = GameId.of('fake-game');

  // The record has no check of its own: a `Score` is valid when it exists (issue #203).
  it('should_take_no_score_when_the_value_is_not_a_valid_score', () => {
    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -12.5]) {
      expect(() => ProgressRecord.of({ gameId, score: Score.of(score) })).toThrow(
        new RangeError(`A score needs a whole number of 0 or more, not ${score}.`),
      );
    }
  });

  it('should_throw_a_range_error_when_a_record_has_stars_that_are_not_finite', () => {
    for (const stars of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      expect(() => ProgressRecord.of({ gameId, score: Score.of(0), stars })).toThrow(RangeError);
      expect(() => ProgressRecord.of({ gameId, score: Score.of(0), stars })).toThrow(
        'A progress record needs a finite number of zero or more stars.',
      );
    }
  });

  it('should_keep_the_values_when_the_score_is_a_score_and_the_stars_are_finite', () => {
    const record = ProgressRecord.of({ gameId, score: Score.of(12), levelId: 'l1', stars: 1.5 });

    expect(record.score).toBeInstanceOf(Score);
    expect(record.score.equals(Score.of(12))).toBe(true);
    expect(record.stars).toBe(1.5);
    expect(record.levelId).toBe('l1');
    expect(ProgressRecord.of({ gameId, score: Score.of(0) }).stars).toBeUndefined();
  });
});

// The level id comes from the level file. A game with no levels has none, and that is valid.
describe('the level id of a progress value', () => {
  const gameId = GameId.of('fake-game');

  it('should_throw_a_range_error_when_a_game_result_has_a_blank_level_id', () => {
    for (const levelId of ['', '   ']) {
      expect(() => GameResult.of({ gameId, score: Score.of(1), moves: 1, levelId })).toThrow(
        new RangeError('A game result needs a level id that is not blank.'),
      );
    }
    expect(GameResult.of({ gameId, score: Score.of(1), moves: 1, levelId: 'l1' }).levelId).toBe(
      'l1',
    );
    expect(GameResult.of({ gameId, score: Score.of(1), moves: 1 }).levelId).toBeUndefined();
  });

  it('should_throw_a_range_error_when_a_progress_record_has_a_blank_level_id', () => {
    for (const levelId of ['', '   ']) {
      expect(() => ProgressRecord.of({ gameId, score: Score.of(1), levelId })).toThrow(
        new RangeError('A progress record needs a level id that is not blank.'),
      );
    }
    expect(ProgressRecord.of({ gameId, score: Score.of(1), levelId: 'l1' }).levelId).toBe('l1');
    expect(ProgressRecord.of({ gameId, score: Score.of(1) }).levelId).toBeUndefined();
  });
});
