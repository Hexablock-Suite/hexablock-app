/** @jest-environment node */
import { GameId } from '../../../src/domain/engine/game-id';
import { GameResult, ProgressRecord } from '../../../src/domain/engine/progress-model';

// A progress record holds finite numbers. Stars stay decimal: no requirement says
// that stars are whole numbers.
describe('ProgressRecord', () => {
  const gameId = GameId.of('fake-game');

  it('should_throw_a_range_error_when_a_record_has_a_score_that_is_not_finite', () => {
    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => ProgressRecord.of({ gameId, score })).toThrow(RangeError);
      expect(() => ProgressRecord.of({ gameId, score })).toThrow(
        'A progress record needs a score that is a finite number.',
      );
    }
  });

  it('should_throw_a_range_error_when_a_record_has_stars_that_are_not_finite', () => {
    for (const stars of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      expect(() => ProgressRecord.of({ gameId, score: 0, stars })).toThrow(RangeError);
      expect(() => ProgressRecord.of({ gameId, score: 0, stars })).toThrow(
        'A progress record needs a finite number of zero or more stars.',
      );
    }
  });

  it('should_keep_the_values_when_the_score_and_the_stars_are_finite', () => {
    const record = ProgressRecord.of({ gameId, score: -12.5, levelId: 'l1', stars: 1.5 });

    expect(record.score).toBe(-12.5);
    expect(record.stars).toBe(1.5);
    expect(record.levelId).toBe('l1');
    expect(ProgressRecord.of({ gameId, score: 0 }).stars).toBeUndefined();
  });
});

// The level id comes from the level file. A game with no levels has none, and that is valid.
describe('the level id of a progress value', () => {
  const gameId = GameId.of('fake-game');

  it('should_throw_a_range_error_when_a_game_result_has_a_blank_level_id', () => {
    for (const levelId of ['', '   ']) {
      expect(() => GameResult.of({ gameId, score: 1, moves: 1, levelId })).toThrow(
        new RangeError('A game result needs a level id that is not blank.'),
      );
    }
    expect(GameResult.of({ gameId, score: 1, moves: 1, levelId: 'l1' }).levelId).toBe('l1');
    expect(GameResult.of({ gameId, score: 1, moves: 1 }).levelId).toBeUndefined();
  });

  it('should_throw_a_range_error_when_a_progress_record_has_a_blank_level_id', () => {
    for (const levelId of ['', '   ']) {
      expect(() => ProgressRecord.of({ gameId, score: 1, levelId })).toThrow(
        new RangeError('A progress record needs a level id that is not blank.'),
      );
    }
    expect(ProgressRecord.of({ gameId, score: 1, levelId: 'l1' }).levelId).toBe('l1');
    expect(ProgressRecord.of({ gameId, score: 1 }).levelId).toBeUndefined();
  });
});
