import type { ElapsedTime } from '../shared/elapsed-time';
import type { GameProgress } from './game-progress';
import type { Moves } from '../shared/moves';
import type { GameResult, IProgressModel } from './progress-model';
import type { Stars } from './stars';

// The star rule of a level with no timer (classes.md decision 36): the stars that the moves
// of a play win. `SortLevel` implements it (D22).
// The level of a variant holds its star thresholds, and the variants count in two ways,
// so each way has its own rule (issue #424). The engine names no variant.
export interface IStarsByMoves {
  starsFor(moves: Moves): Stars;
}

// The star rule of a timed level (classes.md decision 36): the stars that the moves and
// the time of a play win. `FitLevel` implements it (D20, D22). A timed level always gets
// the time of the play, so the rule takes no missing time (issue #424).
export interface IStarsByMovesAndTime {
  starsFor(moves: Moves, elapsedMs: ElapsedTime): Stars;
}

// The progress model of a game with levels: Fit and Sort (statement §5.1.2, APP-FR-02).
// It counts the stars of each result with the star rule of the level,
// and records the result of the level with its stars, its moves and its time.
// The progress keeps the best result of each level by the order of DS-4 and DS-12.
// The variant factory picks the star rule in `createProgressModel()` (issue #424):
// `byMoves()` for a level with no timer, and `byMovesAndTime()` for a timed level.
// So the constructor is private, and `count` asks the result for its stars by that rule.
export class LevelProgress implements IProgressModel {
  private constructor(private readonly count: (result: GameResult) => Stars) {}

  // The model of a level with no timer: the stars by the moves of each play.
  static byMoves(level: IStarsByMoves): LevelProgress {
    return new LevelProgress((result) => result.starsByMoves(level));
  }

  // The model of a timed level: the stars by the moves and the time of each play.
  static byMovesAndTime(level: IStarsByMovesAndTime): LevelProgress {
    return new LevelProgress((result) => result.starsByMovesAndTime(level));
  }

  record(result: GameResult, progress: GameProgress): void {
    progress.recordLevel(result.recordWith(this.count(result)));
  }
}
