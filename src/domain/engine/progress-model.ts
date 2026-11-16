import type { ElapsedTime } from './elapsed-time';
import type { GameId } from './game-id';
import type { GameProgress } from './game-progress';
import type { LevelId } from './level-id';
import type { ILevelStars } from './level-progress';
import type { Moves } from './moves';
import type { Score } from './score';
import type { Stars } from './stars';

// The result of one finished game. It is a value object (view 4).
// `levelId` exists only for games with levels, and `elapsedMs` only for timed games.
// Every field is a value object that checks its own value (classes.md decisions 41 and 42).
// So the result has no check of its own: a `Score`, `Moves`, a `LevelId` and an `ElapsedTime`
// are valid when they exist.
// Every field is private (issue #240). A progress model asks `recordWith()` for its record.
export class GameResult {
  private constructor(
    private readonly gameId: GameId,
    private readonly score: Score,
    private readonly moves: Moves,
    private readonly levelId?: LevelId,
    private readonly elapsedMs?: ElapsedTime,
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

  // The record that a progress model keeps for this result: the game id, the score and
  // the level id of the result, with `stars`. A model of a game with no levels gives no stars.
  // A model of a game with levels counts the stars of the level. Then the record also keeps
  // the moves and the time of the play (issue #156): DS-4 ranks two plays of a level by them,
  // and DS-5 sends a level result with them.
  recordWith(stars?: Stars): ProgressRecord {
    if (stars === undefined) {
      return ProgressRecord.of({ gameId: this.gameId, score: this.score, levelId: this.levelId });
    }
    return ProgressRecord.of({
      gameId: this.gameId,
      score: this.score,
      levelId: this.levelId,
      stars,
      moves: this.moves,
      elapsedMs: this.elapsedMs,
    });
  }

  // The stars that `level` gives to the play of this result.
  // The result gives its moves and its time to the level, and the level answers.
  starsBy(level: ILevelStars): Stars {
    return level.starsFor(this.moves, this.elapsedMs);
  }
}

// What a progress model keeps for one game or one level. It is a value object.
// The record of a game with no levels keeps the game id and the score: the high score.
// The record of a level also keeps the level id, the stars, the moves and the time of its play,
// the fields of a level result in DS-5 (issue #156). A level with no timer has no time.
// Every field is a value object that checks its own value (classes.md decisions 41 and 42).
// So the record has no check of its own: a `Score`, a `LevelId`, `Stars`, `Moves`
// and an `ElapsedTime` are valid when they exist.
// Every field is private (issue #240). A progress keeps the best record with `improves()`.
// A repository of the edge receives the fields through `deliverTo()` (issue #164).
export class ProgressRecord {
  private constructor(
    private readonly gameId: GameId,
    private readonly score: Score,
    private readonly levelId?: LevelId,
    private readonly stars?: Stars,
    private readonly moves?: Moves,
    private readonly elapsedMs?: ElapsedTime,
  ) {}

  static of(values: {
    gameId: GameId;
    score: Score;
    levelId?: LevelId;
    stars?: Stars;
    moves?: Moves;
    elapsedMs?: ElapsedTime;
  }): ProgressRecord {
    return new ProgressRecord(
      values.gameId,
      values.score,
      values.levelId,
      values.stars,
      values.moves,
      values.elapsedMs,
    );
  }

  // Two records are equal when every field is equal.
  // The game id comes last, so no condition of this method depends on it (APP-NFR-08).
  equals(other: ProgressRecord): boolean {
    return (
      this.score.equals(other.score) &&
      sameOptional(this.levelId, other.levelId, (left, right) => left.equals(right)) &&
      sameOptional(this.stars, other.stars, (left, right) => left.equals(right)) &&
      sameOptional(this.moves, other.moves, (left, right) => left.equals(right)) &&
      sameOptional(this.elapsedMs, other.elapsedMs, (left, right) => left.equals(right)) &&
      this.gameId.equals(other.gameId)
    );
  }

  // Tells if this record and `other` are the results of one level.
  // Two records with no level id are of one game with no levels.
  isForSameLevelAs(other: ProgressRecord): boolean {
    return sameOptional(this.levelId, other.levelId, (left, right) => left.equals(right));
  }

  // Tells if this record is better than `other`, the stored record of the same game or level.
  // A game with no levels ranks by its score: a higher score is better.
  // A level ranks by the order of DS-4 and DS-12: more stars win; on equal stars, fewer moves
  // win; on equal moves, less time wins. A record with no moves or no time ties on that step.
  // A level with no timer has no time, so equal stars and equal moves are a full tie.
  // A tie keeps `other`, so a player never loses a best result.
  improves(other: ProgressRecord): boolean {
    if (this.stars === undefined || other.stars === undefined) {
      return this.score.isHigherThan(other.score);
    }
    return (
      ranked(this.stars, other.stars, (left, right) => left.isMoreThan(right)) ??
      ranked(this.moves, other.moves, (left, right) => left.isFewerThan(right)) ??
      ranked(this.elapsedMs, other.elapsedMs, (left, right) => left.isShorterThan(right)) ??
      false
    );
  }

  // Gives the value objects of this record to `receiver`. It returns nothing.
  // A record of a game with no levels gives no level id, no stars, no moves and no time.
  // Only a repository of the edge calls it (rule R-no-delivery-call).
  deliverTo(receiver: ProgressRecordReceiver): void {
    receiver.receive(this.gameId, this.score, this.levelId, this.stars, this.moves, this.elapsedMs);
  }
}

// The receiver of the value objects of a `ProgressRecord`. A repository of the edge
// implements it, for example to save the record (issue #164). No code of `src/domain/`
// or `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface ProgressRecordReceiver {
  receive(
    gameId: GameId,
    score: Score,
    levelId: LevelId | undefined,
    stars: Stars | undefined,
    moves: Moves | undefined,
    elapsedMs: ElapsedTime | undefined,
  ): void;
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

// One step of the order of DS-4. `better` is the comparison of the value objects of the step.
// It tells if `left` is better than `right`. It gives `undefined` when neither value is better
// or when one value is missing, so the next step decides.
function ranked<T>(
  left: T | undefined,
  right: T | undefined,
  better: (left: T, right: T) => boolean,
): boolean | undefined {
  if (left === undefined || right === undefined) return undefined;
  if (better(left, right)) return true;
  if (better(right, left)) return false;
  return undefined;
}

// Strategy (statement §3.3, §5.1): how a game turns a result into progress.
// The variant factory picks the model (classes.md decision 31).
// `record()` records `result` in `progress`, the progress of the game of the result.
// The progress is an entity, so `record()` changes it in place, as `IGameRules.apply()`
// changes a state. A model of a game with no levels records the high score,
// and a model of a game with levels records the result of the level.
export interface IProgressModel {
  record(result: GameResult, progress: GameProgress): void;
}
