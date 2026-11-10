/** @jest-environment node */
import { ElapsedTime } from '../../../src/domain/engine/elapsed-time';
import { GameId } from '../../../src/domain/engine/game-id';
import { LevelId } from '../../../src/domain/engine/level-id';
import { Moves } from '../../../src/domain/engine/moves';
import { GameResult, ProgressRecord } from '../../../src/domain/engine/progress-model';
import { Score } from '../../../src/domain/engine/score';
import { Stars } from '../../../src/domain/engine/stars';

// A progress value holds value objects: a `Score`, `Moves`, a `LevelId`, an `ElapsedTime`
// and `Stars`. It has no check of its own: each value object is valid when it exists
// (issues #203 and #204).
describe('ProgressRecord', () => {
  const gameId = GameId.of('fake-game');

  it('should_take_no_score_when_the_value_is_not_a_valid_score', () => {
    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -12.5]) {
      expect(() => ProgressRecord.of({ gameId, score: Score.of(score) })).toThrow(
        new RangeError(`A score needs a whole number of 0 or more, not ${score}.`),
      );
    }
  });

  // Before issue #204 the record took any finite number of stars, so 1.5 stars were valid.
  it('should_take_no_stars_when_the_value_is_not_a_valid_star_count', () => {
    for (const stars of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1.5]) {
      expect(() =>
        ProgressRecord.of({ gameId, score: Score.of(0), stars: Stars.of(stars) }),
      ).toThrow(new RangeError(`A star count needs a whole number of 0 or more, not ${stars}.`));
    }
  });

  it('should_keep_the_value_objects_when_a_record_has_a_score_a_level_and_stars', () => {
    const record = ProgressRecord.of({
      gameId,
      score: Score.of(12),
      levelId: LevelId.of('l1'),
      stars: Stars.of(2),
    });

    expect(record.score).toBeInstanceOf(Score);
    expect(record.score.equals(Score.of(12))).toBe(true);
    expect(record.stars).toBeInstanceOf(Stars);
    expect(record.stars?.equals(Stars.of(2))).toBe(true);
    expect(record.levelId).toBeInstanceOf(LevelId);
    expect(record.levelId?.equals(LevelId.of('l1'))).toBe(true);
    expect(ProgressRecord.of({ gameId, score: Score.of(0), stars: Stars.of(0) }).stars).toEqual(
      Stars.of(0),
    );
  });

  // A game with no levels has no level id and no stars, and that is valid.
  it('should_hold_no_level_and_no_stars_when_a_record_names_none', () => {
    const record = ProgressRecord.of({ gameId, score: Score.of(0) });

    expect(record.levelId).toBeUndefined();
    expect(record.stars).toBeUndefined();
  });
});

describe('GameResult', () => {
  const gameId = GameId.of('fake-game');

  it('should_take_no_moves_when_the_value_is_not_a_valid_move_count', () => {
    for (const moves of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => GameResult.of({ gameId, score: Score.of(0), moves: Moves.of(moves) })).toThrow(
        new RangeError(`A move count needs a whole number of 0 or more, not ${moves}.`),
      );
    }
  });

  // Before issue #204 the result took any finite time of 0 or more, so 0.5 ms was valid.
  it('should_take_no_time_when_the_value_is_not_a_valid_elapsed_time', () => {
    for (const ms of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        GameResult.of({
          gameId,
          score: Score.of(0),
          moves: Moves.of(0),
          elapsedMs: ElapsedTime.ofMs(ms),
        }),
      ).toThrow(
        new RangeError(
          `An elapsed time needs a whole number of milliseconds of 0 or more, not ${ms}.`,
        ),
      );
    }
  });

  it('should_take_no_level_id_when_the_text_is_blank', () => {
    for (const levelId of ['', '   ']) {
      expect(() =>
        GameResult.of({
          gameId,
          score: Score.of(1),
          moves: Moves.of(1),
          levelId: LevelId.of(levelId),
        }),
      ).toThrow(new RangeError('A level id cannot be empty.'));
      expect(() =>
        ProgressRecord.of({ gameId, score: Score.of(1), levelId: LevelId.of(levelId) }),
      ).toThrow(new RangeError('A level id cannot be empty.'));
    }
  });

  it('should_keep_the_value_objects_when_a_result_has_moves_a_level_and_a_time', () => {
    const result = GameResult.of({
      gameId: GameId.of('hexa-fit'),
      levelId: LevelId.of('fit-01'),
      score: Score.of(0),
      moves: Moves.of(12),
      elapsedMs: ElapsedTime.ofMs(3000),
    });

    expect(result.moves).toBeInstanceOf(Moves);
    expect(result.moves.equals(Moves.of(12))).toBe(true);
    expect(result.levelId).toBeInstanceOf(LevelId);
    expect(result.levelId?.equals(LevelId.of('fit-01'))).toBe(true);
    expect(result.elapsedMs).toBeInstanceOf(ElapsedTime);
    expect(result.elapsedMs?.equals(ElapsedTime.ofMs(3000))).toBe(true);
  });

  // A game with no levels has no level id, and a game with no timer has no time.
  it('should_hold_no_level_and_no_time_when_a_result_names_none', () => {
    const result = GameResult.of({ gameId, score: Score.of(1), moves: Moves.of(1) });

    expect(result.levelId).toBeUndefined();
    expect(result.elapsedMs).toBeUndefined();
  });
});
