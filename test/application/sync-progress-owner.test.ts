/** @jest-environment node */
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import type { ProgressGateway } from '../../src/application/progress-gateway';
import { FailureCode } from '../../src/application/result';
import { SaveProgress } from '../../src/application/save-progress';
import { Session } from '../../src/application/session';
import type { SessionStore } from '../../src/application/session-store';
import { SyncProgress } from '../../src/application/sync-progress';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import {
  GameResult,
  ProgressRecord,
  type IProgressModel,
} from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';

// Issue #46, judgment-day round 1: `SyncProgress` reads the owner of the progress once, sends the
// request outside the queue of the repository, and merges the answer into the progress that the
// store holds at that moment. So a save during the request survives (F1), and a sync writes only to
// the owner that it read at its start (F2). The tests run the real `LocalProgressRepository` over
// the in-memory store and look at its keys.

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');
const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const GRACE = new Session('token-of-grace', '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f');
const keyOf = (session: Session, gameId: string) => `progress:${session.userId}:${gameId}`;

const level = (id: string, stars: number, moves: number, ms: number) =>
  ProgressRecord.of({
    gameId: FIT,
    score: Score.of(0),
    levelId: LevelId.of(id),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ElapsedTime.ofMs(ms),
  });
const highScore = (score: number) => ProgressRecord.of({ gameId: LINES, score: Score.of(score) });

// A session store in memory. `failAfter` makes each read after that many reads throw, as a
// secure storage that locks during a request does.
class MemorySessions implements SessionStore {
  private reads = 0;
  private kept: Session | undefined;
  constructor(
    session: Session | undefined,
    private readonly failAfter = Number.POSITIVE_INFINITY,
  ) {
    this.kept = session;
  }
  read(): Promise<Session | undefined> {
    this.reads += 1;
    if (this.reads > this.failAfter) return Promise.reject(new Error('The storage is locked.'));
    return Promise.resolve(this.kept);
  }
  owner(): Promise<string | undefined> {
    return this.read().then((session) => session?.userId);
  }
  write(session: Session): Promise<void> {
    this.kept = session;
    return Promise.resolve();
  }
  clear(): Promise<void> {
    this.kept = undefined;
    return Promise.resolve();
  }
}

// A gateway that holds each request until the test calls `answer()`.
class HeldGateway implements ProgressGateway {
  private release: ((progress: GameProgress) => void) | undefined;
  readonly started: Promise<void>;
  private start: () => void = () => undefined;
  constructor(private readonly reply: GameProgress) {
    this.started = new Promise((resolve) => {
      this.start = resolve;
    });
  }
  sync(): Promise<GameProgress> {
    this.start();
    return new Promise((resolve) => {
      this.release = resolve;
    });
  }
  answer(): void {
    this.release?.(this.reply);
  }
}

// A progress model that records `record` for each result, as the model of a variant does.
// A record of Hexa Lines is a high score, and a record of Hexa Fit is a level result.
const modelOf = (record: ProgressRecord): IProgressModel => ({
  record: (_result, progress) =>
    record.isOfGame(LINES) ? progress.recordScore(record) : progress.recordLevel(record),
});

function progressOf(gameId: GameId, ...records: ProgressRecord[]): GameProgress {
  const progress = GameProgress.start(gameId);
  for (const record of records) {
    if (record.isOfGame(LINES)) progress.recordScore(record);
    else progress.recordLevel(record);
  }
  return progress;
}

// The saved JSON under `key`, or `undefined`.
async function savedAt(store: InMemoryKeyValueStore, key: string): Promise<unknown> {
  const text = await store.get(key);
  return text === undefined ? undefined : JSON.parse(text);
}

async function seed(store: InMemoryKeyValueStore, key: string, json: unknown): Promise<void> {
  await store.set(key, JSON.stringify(json));
}

// A save of the result `saved` while the sync request of `gameId` waits. The store holds `before`
// and the backend answers `answer`. It gives the answers of both use cases and the saved JSON.
async function saveDuringSync(play: {
  gameId: GameId;
  before: unknown;
  answer: GameProgress;
  saved: ProgressRecord;
}) {
  const store = new InMemoryKeyValueStore();
  const sessions = new MemorySessions(ADA);
  const repository = new LocalProgressRepository(store, sessions);
  const key = keyOf(ADA, play.gameId === FIT ? 'hexa-fit' : 'hexa-lines');
  await seed(store, key, play.before);
  const gateway = new HeldGateway(play.answer);

  const sync = new SyncProgress(sessions, repository, repository, gateway).execute({
    gameId: play.gameId,
  });
  await gateway.started;
  const save = await new SaveProgress(repository, modelOf(play.saved), play.gameId).execute(
    GameResult.endless({ gameId: play.gameId, score: Score.of(0) }),
  );
  gateway.answer();
  return { save, sync: await sync, saved: await savedAt(store, key) };
}

describe('SyncProgress and the progress saved during its request', () => {
  it('should_keep_the_won_level_when_a_save_lands_while_the_sync_request_is_pending', async () => {
    const { save, sync, saved } = await saveDuringSync({
      gameId: FIT,
      before: {
        version: 1,
        levels: [{ score: 0, levelId: 'fit-01', stars: 2, moves: 12, elapsedMs: 9000 }],
      },
      answer: progressOf(FIT, level('fit-01', 2, 12, 9000)),
      saved: level('fit-02', 3, 8, 4000),
    });

    expect(save.ok).toBe(true);
    expect(sync.ok).toBe(true);
    expect(saved).toEqual({
      version: 1,
      levels: [
        { score: 0, levelId: 'fit-01', stars: 2, moves: 12, elapsedMs: 9000 },
        { score: 0, levelId: 'fit-02', stars: 3, moves: 8, elapsedMs: 4000 },
      ],
    });
  });

  it('should_keep_the_high_score_when_a_save_lands_while_the_sync_request_is_pending', async () => {
    const { save, sync, saved } = await saveDuringSync({
      gameId: LINES,
      before: { version: 1, highScore: { score: 20 }, levels: [] },
      answer: progressOf(LINES, highScore(20)),
      saved: highScore(50),
    });

    expect(save.ok).toBe(true);
    expect(sync.ok).toBe(true);
    expect(saved).toEqual({ version: 1, highScore: { score: 50 }, levels: [] });
  });
});

describe('SyncProgress and the owner of the progress', () => {
  it('should_merge_the_answer_into_the_progress_of_the_first_owner_when_the_session_changes_during_the_request', async () => {
    const store = new InMemoryKeyValueStore();
    const sessions = new MemorySessions(ADA);
    const repository = new LocalProgressRepository(store, sessions);
    await seed(store, keyOf(ADA, 'hexa-fit'), {
      version: 1,
      levels: [{ score: 0, levelId: 'fit-01', stars: 2, moves: 12, elapsedMs: 9000 }],
    });
    const gateway = new HeldGateway(progressOf(FIT, level('fit-02', 1, 40, 20000)));

    const sync = new SyncProgress(sessions, repository, repository, gateway).execute({
      gameId: FIT,
    });
    await gateway.started;
    await sessions.write(GRACE);
    gateway.answer();
    const result = await sync;

    expect(result.ok).toBe(true);
    expect(await savedAt(store, keyOf(ADA, 'hexa-fit'))).toEqual({
      version: 1,
      levels: [
        { score: 0, levelId: 'fit-01', stars: 2, moves: 12, elapsedMs: 9000 },
        { score: 0, levelId: 'fit-02', stars: 1, moves: 40, elapsedMs: 20000 },
      ],
    });
    await expect(store.get(keyOf(GRACE, 'hexa-fit'))).resolves.toBeUndefined();
  });

  it('should_write_nothing_to_the_anonymous_progress_when_the_session_cannot_be_read_again_during_the_sync', async () => {
    const store = new InMemoryKeyValueStore();
    const sessions = new MemorySessions(ADA, 2);
    const repository = new LocalProgressRepository(store, sessions);
    await seed(store, keyOf(ADA, 'hexa-fit'), {
      version: 1,
      levels: [{ score: 0, levelId: 'fit-01', stars: 2, moves: 12, elapsedMs: 9000 }],
    });
    const gateway = new HeldGateway(progressOf(FIT, level('fit-02', 1, 40, 20000)));

    const sync = new SyncProgress(sessions, repository, repository, gateway).execute({
      gameId: FIT,
    });
    await Promise.race([gateway.started, sync]);
    gateway.answer();
    await sync;

    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  it('should_give_sync_failed_and_write_nothing_when_the_session_cannot_be_read', async () => {
    const store = new InMemoryKeyValueStore();
    const sessions = new MemorySessions(ADA, 0);
    const repository = new LocalProgressRepository(store, sessions);
    const gateway = new HeldGateway(progressOf(FIT));

    const result = await new SyncProgress(sessions, repository, repository, gateway).execute({
      gameId: FIT,
    });

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.syncFailed);
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
    await expect(store.get(keyOf(ADA, 'hexa-fit'))).resolves.toBeUndefined();
  });
});
