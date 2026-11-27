import type { AnonymousProgress } from '../application/anonymous-progress';
import type { ProgressRepository } from '../application/progress-repository';
import type { SessionStore } from '../application/session-store';
import { ElapsedTime } from '../domain/shared/elapsed-time';
import type { GameId } from '../domain/shared/game-id';
import { GameProgress } from '../domain/progress/game-progress';
import { LevelId } from '../domain/progress/level-id';
import { Moves } from '../domain/shared/moves';
import { ProgressRecord } from '../domain/progress/progress-model';
import { Score } from '../domain/shared/score';
import { Stars } from '../domain/progress/stars';
import { onlyValue, optionalValueOf, valueOf } from './delivered';
import type { KeyValueStore } from './key-value-store';
import { isObject, numberIn, optionalNumberIn, optionalOf, optionalTextIn } from './saved-json';

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

// Adapter of the `ProgressRepository` port over the local storage (classes.md decision 57,
// issue #164). It keeps the progress of each game as one JSON text in a `KeyValueStore`.
// The key carries the user (D27, issue #46, classes.md decision 66). With a signed-in player of
// `sessions`, the key is `progress:<user id>:<game id>`, so two accounts on one device do not
// share progress. With no session, the key is `progress:<game id>`: the anonymous space, the key
// of every progress saved before #46. A game id has no `:`, so the two keys never meet.
// It also implements `AnonymousProgress`, the second role of the one repository of the progress:
// `loadAnonymous()` and `forgetAnonymous()` read and forget the anonymous space whatever the
// session, so `SyncProgress` merges it into the first account that signs in.
// The saved JSON holds plain numbers and texts. The adapter reads each value of the domain
// with `deliverTo(receiver)`, the one exit of a value (rule R-no-delivery-call), and never asks
// a domain object for its text. On a load it builds each value object again with its factory
// method, which checks the value, and it builds the progress again with `start()`,
// `recordScore()` and `recordLevel()`. So the progress keeps its rules on the way back.
// A saved text that is not JSON throws a `SyntaxError`. A saved progress of another version
// or of the wrong shape throws a `RangeError`, and so does a value that its value object
// refuses. The adapter never writes over a saved progress that it cannot read.
// A repository with no `sessions` always uses the anonymous space.
export class LocalProgressRepository implements ProgressRepository, AnonymousProgress {
  constructor(
    private readonly store: KeyValueStore,
    private readonly sessions?: SessionStore,
  ) {}

  async load(gameId: GameId): Promise<GameProgress | undefined> {
    return this.loadAt(await this.keyOf(gameId), gameId);
  }

  async save(progress: GameProgress): Promise<void> {
    const { gameId, saved } = onlyValue<{ gameId: GameId; saved: SavedProgress }>((keep) =>
      progress.deliverTo({
        receive: (id, highScore, levels) =>
          keep({
            gameId: id,
            saved: {
              version: VERSION,
              highScore: highScore === undefined ? undefined : savedRecordOf(highScore),
              levels: levels.map(savedRecordOf),
            },
          }),
      }),
    );
    await this.store.set(await this.keyOf(gameId), JSON.stringify(saved));
  }

  loadAnonymous(gameId: GameId): Promise<GameProgress | undefined> {
    return this.loadAt(anonymousKeyOf(gameId), gameId);
  }

  forgetAnonymous(gameId: GameId): Promise<void> {
    return this.store.remove(anonymousKeyOf(gameId));
  }

  // The progress of the game `gameId` saved under `key`, or `undefined` when the key holds none.
  private async loadAt(key: string, gameId: GameId): Promise<GameProgress | undefined> {
    const text = await this.store.get(key);
    if (text === undefined) return undefined;
    return progressOf(gameId, JSON.parse(text));
  }

  // The key of the progress of a game for the signed-in player, or the anonymous key.
  // A session that cannot be read gives the anonymous key: the web build has no secure storage
  // (#45), and `SaveProgress` and `ListLevels` need no session (D27).
  private async keyOf(gameId: GameId): Promise<string> {
    const session = await this.sessions?.read().catch(() => undefined);
    if (session === undefined) return anonymousKeyOf(gameId);
    return `progress:${session.userId}:${valueOf(gameId)}`;
  }
}

// The key of the progress of a game saved with no account.
function anonymousKeyOf(gameId: GameId): string {
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
    score: Score.of(numberIn(data, 'score', INVALID)),
    levelId: optionalOf(optionalTextIn(data, 'levelId', INVALID), (text) => LevelId.of(text)),
    stars: optionalOf(optionalNumberIn(data, 'stars', INVALID), (count) => Stars.of(count)),
    moves: optionalOf(optionalNumberIn(data, 'moves', INVALID), (count) => Moves.of(count)),
    elapsedMs: optionalOf(optionalNumberIn(data, 'elapsedMs', INVALID), (ms) =>
      ElapsedTime.ofMs(ms),
    ),
  });
}
