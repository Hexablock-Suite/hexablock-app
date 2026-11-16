import type { ElapsedTime } from './elapsed-time';
import type { GameProgress } from './game-progress';
import type { Moves } from './moves';
import type { GameResult, IProgressModel } from './progress-model';
import type { Stars } from './stars';

// The star rule of one level (classes.md decision 36): the stars that a play of the level wins.
// The level of a variant holds its star thresholds, and the variants count in two ways:
// Fit by moves and time, Sort by moves (D22). So the variant gives this rule to `LevelProgress`,
// and the engine names no variant. A level with no timer gives no time.
export interface ILevelStars {
  starsFor(moves: Moves, elapsedMs: ElapsedTime | undefined): Stars;
}

// The progress model of a game with levels: Fit and Sort (statement §5.1.2, APP-FR-02).
// It counts the stars of each result with the star rule of the level,
// and records the result of the level with its stars, its moves and its time.
// The progress keeps the best result of each level by the order of DS-4 and DS-12.
export class LevelProgress implements IProgressModel {
  constructor(private readonly stars: ILevelStars) {}

  record(result: GameResult, progress: GameProgress): void {
    progress.recordLevel(result.recordWith(result.starsBy(this.stars)));
  }
}
