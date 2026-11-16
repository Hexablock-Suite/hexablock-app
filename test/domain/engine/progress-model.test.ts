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

  // The fields are private (issue #240), so the test compares records with `equals()`.
  it('should_keep_the_value_objects_when_a_record_has_a_score_a_level_and_stars', () => {
    const record = ProgressRecord.of({
      gameId,
      score: Score.of(12),
      levelId: LevelId.of('l1'),
      stars: Stars.of(2),
    });
    const again = ProgressRecord.of({
      gameId,
      score: Score.of(12),
      levelId: LevelId.of('l1'),
      stars: Stars.of(2),
    });

    expect(record.equals(again)).toBe(true);
    expect(record.equals(ProgressRecord.of({ gameId, score: Score.of(12) }))).toBe(false);
    expect(
      ProgressRecord.of({ gameId, score: Score.of(0), stars: Stars.of(0) }).equals(
        ProgressRecord.of({ gameId, score: Score.of(0), stars: Stars.of(0) }),
      ),
    ).toBe(true);
  });

  // A game with no levels has no level id and no stars, and that is valid.
  it('should_hold_no_level_and_no_stars_when_a_record_names_none', () => {
    const record = ProgressRecord.of({ gameId, score: Score.of(0) });

    expect(record.equals(ProgressRecord.of({ gameId, score: Score.of(0) }))).toBe(true);
    expect(
      record.equals(ProgressRecord.of({ gameId, score: Score.of(0), stars: Stars.of(0) })),
    ).toBe(false);
    expect(
      record.equals(ProgressRecord.of({ gameId, score: Score.of(0), levelId: LevelId.of('l1') })),
    ).toBe(false);
  });
});

// The order of DS-4 and DS-12 (issue #240): a level ranks by its stars,
// and a game with no levels ranks by its score. A tie keeps the stored record.
describe('ProgressRecord.improves', () => {
  const gameId = GameId.of('fake-game');
  const level = LevelId.of('l1');
  const levelRecord = (stars: number, score = 0) =>
    ProgressRecord.of({ gameId, score: Score.of(score), levelId: level, stars: Stars.of(stars) });
  const highScore = (score: number) => ProgressRecord.of({ gameId, score: Score.of(score) });

  it('should_improve_the_stored_record_when_the_new_level_record_has_more_stars', () => {
    expect(levelRecord(2).improves(levelRecord(1))).toBe(true);
    expect(levelRecord(1).improves(levelRecord(2))).toBe(false);
    // The score of a level does not rank it (DS-4).
    expect(levelRecord(1, 900).improves(levelRecord(2, 10))).toBe(false);
  });

  it('should_keep_the_stored_record_when_two_level_records_have_equal_stars', () => {
    expect(levelRecord(2, 900).improves(levelRecord(2, 10))).toBe(false);
    expect(levelRecord(0).improves(levelRecord(0))).toBe(false);
  });

  it('should_improve_the_stored_record_when_the_new_high_score_is_higher', () => {
    expect(highScore(36).improves(highScore(35))).toBe(true);
    expect(highScore(35).improves(highScore(36))).toBe(false);
    expect(highScore(36).improves(highScore(36))).toBe(false);
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

  // The fields are private (issue #240), so the test compares results with `equals()`.
  it('should_keep_the_value_objects_when_a_result_has_moves_a_level_and_a_time', () => {
    const values = () => ({
      gameId: GameId.of('hexa-fit'),
      levelId: LevelId.of('fit-01'),
      score: Score.of(0),
      moves: Moves.of(12),
      elapsedMs: ElapsedTime.ofMs(3000),
    });
    const result = GameResult.of(values());

    expect(result.equals(GameResult.of(values()))).toBe(true);
    expect(result.equals(GameResult.of({ ...values(), moves: Moves.of(13) }))).toBe(false);
  });

  // A game with no levels has no level id, and a game with no timer has no time.
  it('should_hold_no_level_and_no_time_when_a_result_names_none', () => {
    const result = GameResult.of({ gameId, score: Score.of(1), moves: Moves.of(1) });

    expect(result.equals(GameResult.of({ gameId, score: Score.of(1), moves: Moves.of(1) }))).toBe(
      true,
    );
    expect(
      result.equals(
        GameResult.of({ gameId, score: Score.of(1), moves: Moves.of(1), levelId: LevelId.of('l') }),
      ),
    ).toBe(false);
    expect(
      result.equals(
        GameResult.of({
          gameId,
          score: Score.of(1),
          moves: Moves.of(1),
          elapsedMs: ElapsedTime.ofMs(0),
        }),
      ),
    ).toBe(false);
  });
});

// A progress model turns a result into a record (issue #240). The record keeps the game id,
// the score and the level id of the result, with the stars that the model counts.
describe('GameResult.recordWith', () => {
  it('should_give_the_record_of_a_high_score_when_the_model_counts_no_stars', () => {
    const result = GameResult.of({
      gameId: GameId.of('hexa-lines'),
      score: Score.of(36),
      moves: Moves.of(4),
    });

    expect(
      result
        .recordWith()
        .equals(ProgressRecord.of({ gameId: GameId.of('hexa-lines'), score: Score.of(36) })),
    ).toBe(true);
  });

  it('should_give_the_record_of_a_level_when_the_model_counts_its_stars', () => {
    const result = GameResult.of({
      gameId: GameId.of('hexa-fit'),
      score: Score.of(0),
      moves: Moves.of(12),
      levelId: LevelId.of('fit-01'),
      elapsedMs: ElapsedTime.ofMs(3000),
    });
    const record = result.recordWith(Stars.of(2));

    expect(
      record.equals(
        ProgressRecord.of({
          gameId: GameId.of('hexa-fit'),
          score: Score.of(0),
          levelId: LevelId.of('fit-01'),
          stars: Stars.of(2),
        }),
      ),
    ).toBe(true);
  });

  // Two results of one level: the record of the better play improves the stored record.
  it('should_compare_two_results_when_each_result_gives_its_record', () => {
    const play = (moves: number) =>
      GameResult.of({
        gameId: GameId.of('hexa-sort'),
        score: Score.of(50),
        moves: Moves.of(moves),
        levelId: LevelId.of('sort-01'),
      });
    const better = play(10).recordWith(Stars.of(3));
    const stored = play(25).recordWith(Stars.of(1));

    expect(better.improves(stored)).toBe(true);
    expect(stored.improves(better)).toBe(false);
  });
});
