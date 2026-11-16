import type { GameId } from './game-id';
import type { LevelId } from './level-id';
import type { ProgressRecord } from './progress-model';
import type { Stars } from './stars';

// The local progress of one game (S3-04, issue #156): its high score and the best result
// of each of its levels. It mirrors the progress of the backend (DS-5), so a sync maps one to one.
// It is an entity (classes.md decision 52): its identity is the id of its game,
// because the device keeps one progress per game. Two progresses are equal when they belong
// to one game, whatever they keep.
// A progress model records each result in it (`IProgressModel`).
// The progress asks each record whether it `improves()` the stored record.
// So it keeps the best record by the order of DS-4 and DS-12, and a tie keeps the stored record.
// Every field is private. A repository of the edge receives the fields through `deliverTo()`
// (issue #164). It builds a saved progress again with `start()`, `recordScore()`
// and `recordLevel()`, so the progress keeps its rules when it comes back from storage.
export class GameProgress {
  private highScore: ProgressRecord | undefined = undefined;
  // One record per level, in the order of the first result of each level.
  // A game has few levels, so `recordLevel()` finds the record of a level in this list.
  private readonly levels: ProgressRecord[] = [];

  private constructor(private readonly gameId: GameId) {}

  // A new progress of the game `gameId`, with no high score and no level result.
  static start(gameId: GameId): GameProgress {
    return new GameProgress(gameId);
  }

  // Two progresses are equal when they belong to one game.
  equals(other: GameProgress): boolean {
    return this.gameId.equals(other.gameId);
  }

  // Keeps `record` as the high score when it improves the stored high score,
  // or when the progress has no high score yet.
  recordScore(record: ProgressRecord): void {
    if (this.highScore === undefined || record.improves(this.highScore)) {
      this.highScore = record;
    }
  }

  // Keeps `record` as the result of its level when it improves the stored result of that level,
  // or when the level has no result yet.
  recordLevel(record: ProgressRecord): void {
    const index = this.levels.findIndex((stored) => stored.isForSameLevelAs(record));
    const stored = this.levels[index];
    if (stored === undefined) {
      this.levels.push(record);
    } else if (record.improves(stored)) {
      this.levels[index] = record;
    }
  }

  // Tells if the progress keeps `record` as its high score or as the result of its level.
  keeps(record: ProgressRecord): boolean {
    return (
      this.highScore?.equals(record) === true || this.levels.some((stored) => stored.equals(record))
    );
  }

  // The stars of the best result of the level `levelId`, or `undefined` when the progress
  // keeps no result of that level. A level won with zero stars gives zero stars.
  // The list of levels asks it for each level (#168).
  starsOf(levelId: LevelId): Stars | undefined {
    for (const stored of this.levels) {
      const stars = stored.starsOf(levelId);
      if (stars !== undefined) return stars;
    }
    return undefined;
  }

  // Gives the game id, the high score and the record of each level to `receiver`.
  // It returns nothing. A progress with no high score gives `undefined` for it.
  // The levels come in the order of the first result of each level, in a new list,
  // so the receiver cannot change the progress. Only a repository of the edge calls it
  // (rule R-no-delivery-call).
  deliverTo(receiver: GameProgressReceiver): void {
    receiver.receive(this.gameId, this.highScore, [...this.levels]);
  }
}

// The receiver of the data of a `GameProgress`. A repository of the edge implements it,
// for example to save the progress (issue #164). No code of `src/domain/`
// or `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface GameProgressReceiver {
  receive(
    gameId: GameId,
    highScore: ProgressRecord | undefined,
    levels: readonly ProgressRecord[],
  ): void;
}
