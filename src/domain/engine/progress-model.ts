import type { ElapsedTime } from './elapsed-time';
import type { GameId } from './game-id';
import type { LevelId } from './level-id';
import type { Moves } from './moves';
import type { Score } from './score';
import type { Stars } from './stars';

// The result of one finished game. It is a value object (view 4).
// `levelId` exists only for games with levels, and `elapsedMs` only for timed games.
// Every field is a value object that checks its own value (classes.md decisions 41 and 42).
// So the result has no check of its own: a `Score`, `Moves`, a `LevelId` and an `ElapsedTime`
// are valid when they exist.
export class GameResult {
  private constructor(
    readonly gameId: GameId,
    readonly score: Score,
    readonly moves: Moves,
    readonly levelId?: LevelId,
    readonly elapsedMs?: ElapsedTime,
  ) {}

  static of(values: {
    gameId: GameId;
    score: Score;
    moves: Moves;
    levelId?: LevelId;
    elapsedMs?: ElapsedTime;
  }): GameResult {
    return new GameResult(
      values.gameId,
      values.score,
      values.moves,
      values.levelId,
      values.elapsedMs,
    );
  }

  // Two results are equal when every field is equal.
  // The game id comes last, so no condition of this method depends on it (APP-NFR-08).
  equals(other: GameResult): boolean {
    return (
      this.score.equals(other.score) &&
      this.moves.equals(other.moves) &&
      sameOptional(this.levelId, other.levelId, (left, right) => left.equals(right)) &&
      sameOptional(this.elapsedMs, other.elapsedMs, (left, right) => left.equals(right)) &&
      this.gameId.equals(other.gameId)
    );
  }
}

// What a progress model keeps for one game or one level. It is a value object.
// Draft: DS-5 fixes the fields the backend receives, and the real models
// (`HighScoreProgress`, `LevelProgress`) can add fields in Sprint 3.
// Every field is a value object that checks its own value (classes.md decisions 41 and 42).
// So the record has no check of its own: a `Score`, a `LevelId` and `Stars`
// are valid when they exist.
export class ProgressRecord {
  private constructor(
    readonly gameId: GameId,
    readonly score: Score,
    readonly levelId?: LevelId,
    readonly stars?: Stars,
  ) {}

  static of(values: {
    gameId: GameId;
    score: Score;
    levelId?: LevelId;
    stars?: Stars;
  }): ProgressRecord {
    return new ProgressRecord(values.gameId, values.score, values.levelId, values.stars);
  }

  // Two records are equal when every field is equal.
  // The game id comes last, so no condition of this method depends on it (APP-NFR-08).
  equals(other: ProgressRecord): boolean {
    return (
      this.score.equals(other.score) &&
      sameOptional(this.levelId, other.levelId, (left, right) => left.equals(right)) &&
      sameOptional(this.stars, other.stars, (left, right) => left.equals(right)) &&
      this.gameId.equals(other.gameId)
    );
  }
}

// Compares two optional value objects with `same`, the `equals()` of their class.
// A game with no levels has no level id and no stars, and a game with no timer has no time.
// Two missing values are equal. A missing value and a present value are different.
function sameOptional<T>(
  left: T | undefined,
  right: T | undefined,
  same: (left: T, right: T) => boolean,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return same(left, right);
}

// Strategy (statement §3.3, §5.1): how a game turns a result into progress.
// The variant factory picks the model (classes.md decision 31).
export interface IProgressModel {
  record(result: GameResult): ProgressRecord;
}
