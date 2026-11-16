import type { ProgressRepository } from '../application/progress-repository';
import { ElapsedTime } from '../domain/engine/elapsed-time';
import type { GameId } from '../domain/engine/game-id';
import { GameProgress } from '../domain/engine/game-progress';
import { LevelId } from '../domain/engine/level-id';
import { Moves } from '../domain/engine/moves';
import { ProgressRecord } from '../domain/engine/progress-model';
import { Score } from '../domain/engine/score';
import { Stars } from '../domain/engine/stars';
import type { ValueReceiver } from '../domain/engine/value-receiver';
import type { KeyValueStore } from './key-value-store';

// The version of the saved shape. A new shape gets a new number, so a later app can tell
// an old saved progress from a new one.
const VERSION = 1;
const INVALID = 'The saved progress of a game is not valid.';
const UNKNOWN_VERSION = 'The saved progress of a game has a version that this app does not read.';

// One saved record: plain numbers and texts. `JSON.stringify()` drops a missing value,
// so the record of a game with no levels has only its score.
interface SavedRecord {
  readonly score: number;
  readonly levelId?: string;
  readonly stars?: number;
  readonly moves?: number;
  readonly elapsedMs?: number;
}

// The saved progress of one game (S3-04): the version of the shape, the high score
// and the best result of each level, in the order of the progress.
interface SavedProgress {
  readonly version: number;
  readonly highScore?: SavedRecord;
  readonly levels: readonly SavedRecord[];
}

// A value object that delivers a value of type `T`.
type Delivers<T> = { deliverTo(receiver: ValueReceiver<T>): void };

// A parsed JSON object.
type JsonObject = Readonly<Record<string, unknown>>;

// Adapter of the `ProgressRepository` port over the local storage (classes.md decision 55,
// issue #164). It keeps the progress of each game as one JSON text under the key
// `progress:<game id>` of a `KeyValueStore`.
// The saved JSON holds plain numbers and texts. The adapter reads each value of the domain
// with `deliverTo(receiver)`, the one exit of a value (rule R-no-delivery-call), and never asks
// a domain object for its text. On a load it builds each value object again with its factory
// method, which checks the value, and it builds the progress again with `start()`,
// `recordScore()` and `recordLevel()`. So the progress keeps its rules on the way back.
// A saved text that is not JSON throws a `SyntaxError`. A saved progress of another version
// or of the wrong shape throws a `RangeError`, and so does a value that its value object
// refuses. The adapter never writes over a saved progress that it cannot read.
export class LocalProgressRepository implements ProgressRepository {
  constructor(private readonly store: KeyValueStore) {}

  async load(gameId: GameId): Promise<GameProgress | undefined> {
    const text = await this.store.get(keyOf(gameId));
    if (text === undefined) return undefined;
    return progressOf(gameId, JSON.parse(text));
  }

  async save(progress: GameProgress): Promise<void> {
    const { key, saved } = onlyValue<{ key: string; saved: SavedProgress }>((keep) =>
      progress.deliverTo({
        receive: (gameId, highScore, levels) =>
          keep({
            key: keyOf(gameId),
            saved: {
              version: VERSION,
              highScore: highScore === undefined ? undefined : savedRecordOf(highScore),
              levels: levels.map(savedRecordOf),
            },
          }),
      }),
    );
    await this.store.set(key, JSON.stringify(saved));
  }
}

// The key of the progress of a game in the store.
function keyOf(gameId: GameId): string {
  return `progress:${valueOf(gameId)}`;
}

// The plain form of a record. The key of the store names the game,
// so the record saves no game id.
function savedRecordOf(record: ProgressRecord): SavedRecord {
  return onlyValue<SavedRecord>((keep) =>
    record.deliverTo({
      receive: (_gameId, score, levelId, stars, moves, elapsedMs) =>
        keep({
          score: valueOf(score),
          levelId: optionalValueOf(levelId),
          stars: optionalValueOf(stars),
          moves: optionalValueOf(moves),
          elapsedMs: optionalValueOf(elapsedMs),
        }),
    }),
  );
}

// The progress of the game `gameId` from its saved JSON. The repository gives each saved
// record to the progress, so a saved list with two records of one level keeps the best one.
function progressOf(gameId: GameId, data: unknown): GameProgress {
  if (!isObject(data)) throw new RangeError(INVALID);
  if (data.version !== VERSION) throw new RangeError(UNKNOWN_VERSION);
  const { highScore, levels } = data;
  if (!Array.isArray(levels)) throw new RangeError(INVALID);
  const progress = GameProgress.start(gameId);
  if (highScore !== undefined) progress.recordScore(recordOf(gameId, highScore));
  for (const level of levels) progress.recordLevel(recordOf(gameId, level));
  return progress;
}

// A record of the game `gameId` from its saved JSON. Each factory method checks its value.
function recordOf(gameId: GameId, data: unknown): ProgressRecord {
  if (!isObject(data)) throw new RangeError(INVALID);
  return ProgressRecord.of({
    gameId,
    score: Score.of(numberIn(data, 'score')),
    levelId: optionalOf(optionalTextIn(data, 'levelId'), (text) => LevelId.of(text)),
    stars: optionalOf(optionalNumberIn(data, 'stars'), (count) => Stars.of(count)),
    moves: optionalOf(optionalNumberIn(data, 'moves'), (count) => Moves.of(count)),
    elapsedMs: optionalOf(optionalNumberIn(data, 'elapsedMs'), (ms) => ElapsedTime.ofMs(ms)),
  });
}

// The one value that `deliver` gives to `keep`. No value, or more than one value, throws.
function onlyValue<T>(deliver: (keep: (value: T) => void) => void): T {
  const values: T[] = [];
  deliver((value) => values.push(value));
  if (values.length !== 1) {
    throw new Error(`The domain object delivered ${values.length} values, not 1.`);
  }
  return values[0];
}

// The value that a value object delivers.
function valueOf<T>(source: Delivers<T>): T {
  return onlyValue<T>((keep) => source.deliverTo({ receive: keep }));
}

// The value of an optional value object, or `undefined` when the object is missing.
function optionalValueOf<T>(source: Delivers<T> | undefined): T | undefined {
  return source === undefined ? undefined : valueOf(source);
}

// `make(value)`, or `undefined` when the value is missing.
function optionalOf<T, R>(value: T | undefined, make: (value: T) => R): R | undefined {
  return value === undefined ? undefined : make(value);
}

// Tells if `data` is a JSON object: not `null` and not a list.
function isObject(data: unknown): data is JsonObject {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

// The number of the field `name`. A missing field or a value of another type throws.
function numberIn(data: JsonObject, name: string): number {
  const value = data[name];
  if (typeof value !== 'number') throw new RangeError(INVALID);
  return value;
}

// The number of the field `name`, or `undefined` when the field is missing.
function optionalNumberIn(data: JsonObject, name: string): number | undefined {
  return data[name] === undefined ? undefined : numberIn(data, name);
}

// The text of the field `name`, or `undefined` when the field is missing.
// A value of another type throws.
function optionalTextIn(data: JsonObject, name: string): string | undefined {
  const value = data[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new RangeError(INVALID);
  return value;
}
