import type { GameId } from './game-id';

// The result of one finished game. It is a value object (view 4).
// `levelId` exists only for games with levels, and `elapsedMs` only for timed games.
// A decimal or negative move count, a score or a time that is not finite, and a negative time, throw a RangeError.
export class GameResult {
  private constructor(
    readonly gameId: GameId,
    readonly score: number,
    readonly moves: number,
    readonly levelId?: string,
    readonly elapsedMs?: number,
  ) {}

  static of(values: {
    gameId: GameId;
    score: number;
    moves: number;
    levelId?: string;
    elapsedMs?: number;
  }): GameResult {
    if (!Number.isInteger(values.moves) || values.moves < 0) {
      throw new RangeError('A game result needs zero or more moves.');
    }
    if (!Number.isFinite(values.score)) {
      throw new RangeError('A game result needs a score that is a finite number.');
    }
    if (
      values.elapsedMs !== undefined &&
      !(Number.isFinite(values.elapsedMs) && values.elapsedMs >= 0)
    ) {
      throw new RangeError('A game result needs a time of zero or more milliseconds.');
    }
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
      this.score === other.score &&
      this.moves === other.moves &&
      this.levelId === other.levelId &&
      this.elapsedMs === other.elapsedMs &&
      this.gameId.equals(other.gameId)
    );
  }
}

// What a progress model keeps for one game or one level. It is a value object.
// Draft: DS-5 fixes the fields the backend receives, and the real models
// (`HighScoreProgress`, `LevelProgress`) can add fields in Sprint 3.
// A score that is not finite throws a RangeError.
// Stars that are not finite or are negative throw a RangeError.
// Stars can be decimal: no requirement says that they are whole numbers.
export class ProgressRecord {
  private constructor(
    readonly gameId: GameId,
    readonly score: number,
    readonly levelId?: string,
    readonly stars?: number,
  ) {}

  static of(values: {
    gameId: GameId;
    score: number;
    levelId?: string;
    stars?: number;
  }): ProgressRecord {
    if (!Number.isFinite(values.score)) {
      throw new RangeError('A progress record needs a score that is a finite number.');
    }
    if (values.stars !== undefined && !(Number.isFinite(values.stars) && values.stars >= 0)) {
      throw new RangeError('A progress record needs a finite number of zero or more stars.');
    }
    return new ProgressRecord(values.gameId, values.score, values.levelId, values.stars);
  }

  // Two records are equal when every field is equal.
  // The game id comes last, so no condition of this method depends on it (APP-NFR-08).
  equals(other: ProgressRecord): boolean {
    return (
      this.score === other.score &&
      this.levelId === other.levelId &&
      this.stars === other.stars &&
      this.gameId.equals(other.gameId)
    );
  }
}

// Strategy (statement §3.3, §5.1): how a game turns a result into progress.
// The variant factory picks the model (classes.md decision 31).
export interface IProgressModel {
  record(result: GameResult): ProgressRecord;
}
