/** @jest-environment node */
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import { GameId } from '../../../src/domain/shared/game-id';
import { LevelId } from '../../../src/domain/progress/level-id';
import { Moves } from '../../../src/domain/shared/moves';
import { GameResult, ProgressRecord } from '../../../src/domain/progress/progress-model';
import { Score } from '../../../src/domain/shared/score';
import { Stars } from '../../../src/domain/progress/stars';
import { recordContentOf } from '../../support/engine/progress-content';

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

  // The record of a level keeps the moves and the time of its play (issue #156, DS-4, DS-5).
  it('should_differ_when_two_level_records_hold_other_moves_or_another_time', () => {
    const record = (moves: number, ms: number) =>
      ProgressRecord.of({
        gameId,
        score: Score.of(0),
        levelId: LevelId.of('l1'),
        stars: Stars.of(2),
        moves: Moves.of(moves),
        elapsedMs: ElapsedTime.ofMs(ms),
      });

    expect(record(10, 5000).equals(record(10, 5000))).toBe(true);
    expect(record(10, 5000).equals(record(11, 5000))).toBe(false);
    expect(record(10, 5000).equals(record(10, 5001))).toBe(false);
  });

  // The fields are private. A repository of the edge receives them through `deliverTo()`
  // (issue #164), and the delivery returns nothing.
  it('should_deliver_each_value_object_when_a_receiver_takes_the_record_of_a_level', () => {
    const record = ProgressRecord.of({
      gameId,
      score: Score.of(12),
      levelId: LevelId.of('l1'),
      stars: Stars.of(2),
      moves: Moves.of(9),
      elapsedMs: ElapsedTime.ofMs(3000),
    });

    const content = recordContentOf(record);

    expect([
      content.gameId.equals(gameId),
      content.score.equals(Score.of(12)),
      content.levelId?.equals(LevelId.of('l1')),
      content.stars?.equals(Stars.of(2)),
      content.moves?.equals(Moves.of(9)),
      content.elapsedMs?.equals(ElapsedTime.ofMs(3000)),
    ]).toEqual([true, true, true, true, true, true]);
    expect(record.deliverTo({ receive: () => undefined })).toBeUndefined();
  });

  it('should_deliver_no_level_values_when_a_receiver_takes_the_record_of_a_high_score', () => {
    const content = recordContentOf(ProgressRecord.of({ gameId, score: Score.of(36) }));

    expect(content.gameId.equals(gameId)).toBe(true);
    expect(content.score.equals(Score.of(36))).toBe(true);
    expect([content.levelId, content.stars, content.moves, content.elapsedMs]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
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

  // Issue #168: a progress asks each record for the stars of a level.
  it('should_give_its_stars_only_for_its_own_level_when_a_record_is_asked_for_the_stars_of_a_level', () => {
    const levelRecord = ProgressRecord.of({
      gameId,
      score: Score.of(0),
      levelId: LevelId.of('l1'),
      stars: Stars.of(2),
    });
    const highScore = ProgressRecord.of({ gameId, score: Score.of(36) });

    expect(levelRecord.starsOf(LevelId.of('l1'))?.equals(Stars.of(2))).toBe(true);
    expect(levelRecord.starsOf(LevelId.of('l2'))).toBeUndefined();
    expect(highScore.starsOf(LevelId.of('l1'))).toBeUndefined();
  });

  // Issue #372: a progress asks each record whether it is of its game.
  // The record keeps its game id private, so the record answers.
  it('should_tell_whether_it_is_of_a_game_when_a_record_is_asked_for_its_game', () => {
    const levelRecord = ProgressRecord.of({
      gameId,
      score: Score.of(0),
      levelId: LevelId.of('l1'),
      stars: Stars.of(2),
    });
    const highScore = ProgressRecord.of({ gameId, score: Score.of(36) });
    const otherGame = GameId.of('other-game');

    expect([
      levelRecord.isOfGame(GameId.of('fake-game')),
      highScore.isOfGame(GameId.of('fake-game')),
      levelRecord.isOfGame(otherGame),
      highScore.isOfGame(otherGame),
    ]).toEqual([true, true, false, false]);
  });
});

// The order of DS-4 and DS-12 (issues #240 and #156): a level ranks by its stars, then by
// fewer moves, then by less time. A game with no levels ranks by its score.
// A tie keeps the stored record.
describe('ProgressRecord.improves', () => {
  const gameId = GameId.of('fake-game');
  const level = LevelId.of('l1');
  const levelRecord = (stars: number, score = 0) =>
    ProgressRecord.of({ gameId, score: Score.of(score), levelId: level, stars: Stars.of(stars) });
  const highScore = (score: number) => ProgressRecord.of({ gameId, score: Score.of(score) });
  // The record of one play of the level. A Sort level has no timer, so its play has no time.
  const play = (stars: number, moves: number, ms?: number) =>
    ProgressRecord.of({
      gameId,
      score: Score.of(0),
      levelId: level,
      stars: Stars.of(stars),
      moves: Moves.of(moves),
      elapsedMs: ms === undefined ? undefined : ElapsedTime.ofMs(ms),
    });

  it('should_improve_the_stored_record_when_the_new_level_record_has_more_stars', () => {
    expect(levelRecord(2).improves(levelRecord(1))).toBe(true);
    expect(levelRecord(1).improves(levelRecord(2))).toBe(false);
    // The score of a level does not rank it (DS-4).
    expect(levelRecord(1, 900).improves(levelRecord(2, 10))).toBe(false);
    // Fewer moves and less time do not beat more stars.
    expect(play(1, 5, 1000).improves(play(2, 50, 9000))).toBe(false);
  });

  // Two records with no moves and no time tie when their stars are equal.
  it('should_keep_the_stored_record_when_two_level_records_have_equal_stars_and_no_play', () => {
    expect(levelRecord(2, 900).improves(levelRecord(2, 10))).toBe(false);
    expect(levelRecord(0).improves(levelRecord(0))).toBe(false);
  });

  it('should_improve_the_stored_record_when_the_new_level_record_ties_on_stars_with_fewer_moves', () => {
    expect(play(2, 10, 9000).improves(play(2, 11, 1000))).toBe(true);
    expect(play(2, 11, 1000).improves(play(2, 10, 9000))).toBe(false);
    expect(play(2, 10).improves(play(2, 11))).toBe(true);
  });

  it('should_improve_the_stored_record_when_the_new_level_record_ties_on_stars_and_moves_with_less_time', () => {
    expect(play(2, 10, 4999).improves(play(2, 10, 5000))).toBe(true);
    expect(play(2, 10, 5000).improves(play(2, 10, 4999))).toBe(false);
  });

  // A full tie keeps the stored record, so a player never loses a best result (DS-4).
  it('should_keep_the_stored_record_when_two_level_records_tie_on_stars_moves_and_time', () => {
    expect(play(2, 10, 5000).improves(play(2, 10, 5000))).toBe(false);
    // A Sort level has no timer, so equal stars and equal moves are a full tie.
    expect(play(3, 7).improves(play(3, 7))).toBe(false);
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
// The record of a level also keeps the moves and the time of the play (issue #156, DS-4, DS-5).
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
    const expected = (moves: number) =>
      ProgressRecord.of({
        gameId: GameId.of('hexa-fit'),
        score: Score.of(0),
        levelId: LevelId.of('fit-01'),
        stars: Stars.of(2),
        moves: Moves.of(moves),
        elapsedMs: ElapsedTime.ofMs(3000),
      });

    expect(record.equals(expected(12))).toBe(true);
    expect(record.equals(expected(13))).toBe(false);
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
