import type { AnonymousProgress } from '../application/ports/anonymous-progress';
import { ProgressOwner } from '../application/ports/progress-owner';
import type { ProgressRepository } from '../application/ports/progress-repository';
import type { SessionStore } from '../application/ports/session-store';
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
// The key carries the owner (D27, issue #46, classes.md decision 66). The key of a user is
// `progress:<user id>:<game id>`, so two accounts on one device do not share progress. The key of
// the anonymous owner is `progress:<game id>`: the anonymous space, the key of every progress saved
// before #46. A game id has no `:`, so the two keys never meet.
// `owner()` reads the owner from `sessions`: the last signed-in user, kept apart from the token,
// so a refused token keeps the owner. An owner that cannot be read, and a repository with no
// `sessions`, give the anonymous owner. Every other call takes the owner that the use case read.
// `update()` runs load, change and save in one queue per key, so two changes of one progress never
// overlap and no change is lost (#46, judgment-day round 1).
// It also implements `AnonymousProgress`, the second role of the one repository of the progress:
// `mergeAnonymousInto()` merges the anonymous space into the key of a user and forgets it after the
// save. A device that signed in under #45 kept its progress in the anonymous space. So the first
// `load()` or `update()` of a user whose key is empty merges the anonymous space into that key.
// The saved JSON holds plain numbers and texts. The adapter reads each value of the domain
// with `deliverTo(receiver)`, the one exit of a value (rule R-no-delivery-call), and never asks
// a domain object for its text. On a load it builds each value object again with its factory
// method, which checks the value, and it builds the progress again with `start()`,
// `recordScore()` and `recordLevel()`. So the progress keeps its rules on the way back.
// A saved text that is not JSON throws a `SyntaxError`. A saved progress of another version
// or of the wrong shape throws a `RangeError`, and so does a value that its value object
// refuses. The adapter never writes over a saved progress that it cannot read.
export class LocalProgressRepository implements ProgressRepository, AnonymousProgress {
  // The last write of each key. A new write of a key waits for it.
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    private readonly store: KeyValueStore,
    private readonly sessions?: SessionStore,
  ) {}

  async owner(): Promise<ProgressOwner> {
    const userId = await this.sessions?.owner().catch(() => undefined);
    return userId === undefined ? ProgressOwner.anonymous : ProgressOwner.of(userId);
  }

  async load(owner: ProgressOwner, gameId: GameId): Promise<GameProgress | undefined> {
    await this.adoptAnonymous(owner, gameId);
    return this.loadAt(keyOf(owner, gameId), gameId);
  }

  async update(
    owner: ProgressOwner,
    gameId: GameId,
    change: (progress: GameProgress) => void,
  ): Promise<void> {
    await this.adoptAnonymous(owner, gameId);
    await this.changeAt(keyOf(owner, gameId), gameId, change);
  }

  mergeAnonymousInto(owner: ProgressOwner, gameId: GameId): Promise<void> {
    if (owner.equals(ProgressOwner.anonymous)) return Promise.resolve();
    const anonymousKey = keyOf(ProgressOwner.anonymous, gameId);
    return this.queued(anonymousKey, async () => {
      const anonymous = await this.loadAt(anonymousKey, gameId);
      if (anonymous === undefined) return;
      await this.changeAt(keyOf(owner, gameId), gameId, (progress) =>
        progress.mergeWith(anonymous),
      );
      await this.store.remove(anonymousKey);
    });
  }

  // Merges the anonymous space into the key of the user `owner` when that key holds no progress:
  // the progress of a device that signed in under #45.
  private async adoptAnonymous(owner: ProgressOwner, gameId: GameId): Promise<void> {
    if (owner.equals(ProgressOwner.anonymous)) return;
    if ((await this.store.get(keyOf(owner, gameId))) !== undefined) return;
    await this.mergeAnonymousInto(owner, gameId);
  }

  // Loads the progress under `key`, or starts one, gives it to `change` and saves it, in the
  // queue of `key`.
  private changeAt(
    key: string,
    gameId: GameId,
    change: (progress: GameProgress) => void,
  ): Promise<void> {
    return this.queued(key, async () => {
      const progress = (await this.loadAt(key, gameId)) ?? GameProgress.start(gameId);
      change(progress);
      await this.store.set(key, JSON.stringify(savedOf(progress)));
    });
  }

  // Runs `work` after the last work of `key` ends, whatever its result.
  private queued(key: string, work: () => Promise<void>): Promise<void> {
    const run = (this.queues.get(key) ?? Promise.resolve()).then(work);
    const settled = run.catch(() => undefined);
    this.queues.set(key, settled);
    void settled.then(() => {
      if (this.queues.get(key) === settled) this.queues.delete(key);
    });
    return run;
  }

  // The progress of the game `gameId` saved under `key`, or `undefined` when the key holds none.
  private async loadAt(key: string, gameId: GameId): Promise<GameProgress | undefined> {
    const text = await this.store.get(key);
    if (text === undefined) return undefined;
    return progressOf(gameId, JSON.parse(text));
  }
}

// The key of the progress of the game `gameId` of `owner`.
function keyOf(owner: ProgressOwner, gameId: GameId): string {
  return owner.userId === undefined
    ? `progress:${valueOf(gameId)}`
    : `progress:${owner.userId}:${valueOf(gameId)}`;
}

// The saved form of `progress`.
function savedOf(progress: GameProgress): SavedProgress {
  return onlyValue<SavedProgress>((keep) =>
    progress.deliverTo({
      receive: (_gameId, highScore, levels) =>
        keep({
          version: VERSION,
          highScore: highScore === undefined ? undefined : savedRecordOf(highScore),
          levels: levels.map(savedRecordOf),
        }),
    }),
  );
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
