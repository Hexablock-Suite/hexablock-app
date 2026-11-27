import type { GameProgress } from './game-progress';
import type { GameResult, IProgressModel } from './progress-model';

// The progress model of a game with no levels: Lines and Merge (statement §5.1.4, APP-FR-04).
// It records the score of each result as the high score of the game.
// The progress keeps the higher score, and a tie keeps the stored score (DS-12).
export class HighScoreProgress implements IProgressModel {
  record(result: GameResult, progress: GameProgress): void {
    progress.recordScore(result.recordWith());
  }
}
