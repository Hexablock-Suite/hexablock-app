import type { ElapsedTime } from '../../../src/domain/engine/elapsed-time';
import type { GameId } from '../../../src/domain/engine/game-id';
import type { GameProgress } from '../../../src/domain/engine/game-progress';
import type { LevelId } from '../../../src/domain/engine/level-id';
import type { Moves } from '../../../src/domain/engine/moves';
import type { ProgressRecord } from '../../../src/domain/engine/progress-model';
import type { Score } from '../../../src/domain/engine/score';
import type { Stars } from '../../../src/domain/engine/stars';

// Readers of a progress and of a record. They exist only in test/.
// A progress and a record keep their fields private and deliver them to a receiver (issue #164).

// What a progress delivers: the id of its game, its high score and the result of each level.
export interface ProgressContent {
  readonly gameId: GameId;
  readonly highScore: ProgressRecord | undefined;
  readonly levels: readonly ProgressRecord[];
}

// What a record delivers. A record of a game with no levels has no level values.
export interface RecordContent {
  readonly gameId: GameId;
  readonly score: Score;
  readonly levelId: LevelId | undefined;
  readonly stars: Stars | undefined;
  readonly moves: Moves | undefined;
  readonly elapsedMs: ElapsedTime | undefined;
}

// The content that `progress` delivers. A progress that delivers no content,
// or more than one content, throws.
export function contentOf(progress: GameProgress): ProgressContent {
  const contents: ProgressContent[] = [];
  progress.deliverTo({
    receive: (gameId, highScore, levels) => contents.push({ gameId, highScore, levels }),
  });
  if (contents.length !== 1) {
    throw new Error(`The progress delivered ${contents.length} contents, not 1.`);
  }
  return contents[0];
}

// The content that `record` delivers. A record that delivers no content,
// or more than one content, throws.
export function recordContentOf(record: ProgressRecord): RecordContent {
  const contents: RecordContent[] = [];
  record.deliverTo({
    receive: (gameId, score, levelId, stars, moves, elapsedMs) =>
      contents.push({ gameId, score, levelId, stars, moves, elapsedMs }),
  });
  if (contents.length !== 1) {
    throw new Error(`The record delivered ${contents.length} contents, not 1.`);
  }
  return contents[0];
}

// Tells if two progresses deliver equal value objects: one game id, equal high scores,
// and equal level results in the same order. Each value object compares with `equals()`.
export function sameContent(left: GameProgress, right: GameProgress): boolean {
  const first = contentOf(left);
  const second = contentOf(right);
  return (
    first.gameId.equals(second.gameId) &&
    sameRecord(first.highScore, second.highScore) &&
    first.levels.length === second.levels.length &&
    first.levels.every((record, index) => sameRecord(record, second.levels[index]))
  );
}

// Two missing records are equal. A missing record and a present record are different.
function sameRecord(left: ProgressRecord | undefined, right: ProgressRecord | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.equals(right);
}
