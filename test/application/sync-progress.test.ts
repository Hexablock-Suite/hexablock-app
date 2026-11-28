/** @jest-environment node */
import type { AnonymousProgress } from '../../src/application/ports/anonymous-progress';
import type { ProgressGateway } from '../../src/application/ports/progress-gateway';
import { SyncFailure } from '../../src/application/ports/progress-gateway';
import { ProgressOwner } from '../../src/application/ports/progress-owner';
import type { ProgressRepository } from '../../src/application/ports/progress-repository';
import { FailureCode } from '../../src/application/result';
import { Session } from '../../src/application/ports/session';
import type { SessionStore } from '../../src/application/ports/session-store';
import { SyncProgress } from '../../src/application/progress/sync-progress';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';
import { contentOf, sameContent } from '../support/engine/progress-content';

// Issue #46 (APP-FR-13, D27): `SyncProgress` sends the local progress of one game to the backend
// through the `ProgressGateway` port and merges the answer into the local progress (DS-12).
// The progress played with no account merges into the first account that signs in.
// A failed sync never loses local progress. A refused token gives `session-expired`, and since #481
// `SessionAspect` clears the session, not the use case.

const FIT = GameId.of('hexa-fit');
const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const level = (id: string, stars: number, moves: number, ms: number) =>
  ProgressRecord.of({
    gameId: FIT,
    score: Score.of(0),
    levelId: LevelId.of(id),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ElapsedTime.ofMs(ms),
  });

function fitWith(...records: ProgressRecord[]): GameProgress {
  const progress = GameProgress.start(FIT);
  for (const record of records) progress.recordLevel(record);
  return progress;
}

// A session store in memory that counts its clears.
class MemorySessions implements SessionStore {
  clears = 0;
  constructor(private session: Session | undefined) {}
  read(): Promise<Session | undefined> {
    return Promise.resolve(this.session);
  }
  owner(): Promise<string | undefined> {
    return Promise.resolve(this.session?.userId);
  }
  write(session: Session): Promise<void> {
    this.session = session;
    return Promise.resolve();
  }
  clear(): Promise<void> {
    this.clears += 1;
    this.session = undefined;
    return Promise.resolve();
  }
}

// The local progress of the account and the anonymous progress, each in its own map.
// `owners` records the owner of each load and update. `failSave` makes each save throw, as a
// full disk does. The anonymous progress stays when the save of the merge throws.
class TwoSpaces implements ProgressRepository, AnonymousProgress {
  readonly own = new Map<string, GameProgress>();
  readonly anonymous = new Map<string, GameProgress>();
  readonly owners: (string | undefined)[] = [];
  failSave = false;
  owner(): Promise<ProgressOwner> {
    return Promise.resolve(ProgressOwner.anonymous);
  }
  load(owner: ProgressOwner): Promise<GameProgress | undefined> {
    this.owners.push(owner.userId);
    return Promise.resolve(this.own.get('fit'));
  }
  update(
    owner: ProgressOwner,
    _gameId: GameId,
    change: (progress: GameProgress) => void,
  ): Promise<void> {
    this.owners.push(owner.userId);
    const stored = this.own.get('fit');
    const progress = stored === undefined ? GameProgress.start(FIT) : fitCopy(stored);
    change(progress);
    if (this.failSave) return Promise.reject(new Error('disk full'));
    this.own.set('fit', progress);
    return Promise.resolve();
  }
  async mergeAnonymousInto(owner: ProgressOwner, gameId: GameId): Promise<void> {
    const anonymous = this.anonymous.get('fit');
    if (anonymous === undefined) return;
    await this.update(owner, gameId, (progress) => progress.mergeWith(anonymous));
    this.anonymous.delete('fit');
  }
}

// A gateway that records each sync and answers with `answer`, or throws `failure`.
class FakeGateway implements ProgressGateway {
  readonly sent: { session: Session; progress: GameProgress }[] = [];
  constructor(
    private readonly answer: GameProgress = GameProgress.start(FIT),
    private readonly failure?: unknown,
  ) {}
  sync(session: Session, progress: GameProgress): Promise<GameProgress> {
    this.sent.push({ session, progress: fitCopy(progress) });
    if (this.failure !== undefined) return Promise.reject(this.failure);
    return Promise.resolve(this.answer);
  }
}

// A copy of `progress`, so a later change of the progress does not change what was sent.
function fitCopy(progress: GameProgress): GameProgress {
  const copy = GameProgress.start(FIT);
  copy.mergeWith(progress);
  return copy;
}

describe('SyncProgress', () => {
  it('should_send_nothing_and_change_nothing_when_no_player_signed_in', async () => {
    const spaces = new TwoSpaces();
    spaces.anonymous.set('fit', fitWith(level('fit-01', 2, 12, 9000)));
    const gateway = new FakeGateway();

    const result = await new SyncProgress(
      new MemorySessions(undefined),
      spaces,
      spaces,
      gateway,
    ).execute({ gameId: FIT });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(gateway.sent).toHaveLength(0);
    expect(spaces.own.size).toBe(0);
    expect(spaces.anonymous.size).toBe(1);
  });

  it('should_send_the_local_progress_with_the_session_and_keep_the_merged_answer_when_a_player_signed_in', async () => {
    const spaces = new TwoSpaces();
    spaces.own.set('fit', fitWith(level('fit-01', 2, 12, 9000)));
    // The backend keeps a better fit-01 from another device and a result of fit-02.
    const gateway = new FakeGateway(
      fitWith(level('fit-01', 3, 10, 8000), level('fit-02', 1, 40, 20000)),
    );

    const result = await new SyncProgress(new MemorySessions(ADA), spaces, spaces, gateway).execute(
      {
        gameId: FIT,
      },
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.session).toBe(ADA);
    expect(spaces.owners).toEqual([ADA.userId, ADA.userId]);
    expect(sameContent(gateway.sent[0]!.progress, fitWith(level('fit-01', 2, 12, 9000)))).toBe(
      true,
    );
    const kept = spaces.own.get('fit')!;
    expect(kept.keeps(level('fit-01', 3, 10, 8000))).toBe(true);
    expect(kept.keeps(level('fit-02', 1, 40, 20000))).toBe(true);
    expect(contentOf(kept).levels).toHaveLength(2);
  });

  // D27: the progress played with no account merges into the first account that signs in.
  it('should_merge_the_anonymous_progress_into_the_account_and_forget_it_when_the_player_signed_in', async () => {
    const spaces = new TwoSpaces();
    spaces.own.set('fit', fitWith(level('fit-01', 1, 30, 9000)));
    spaces.anonymous.set(
      'fit',
      fitWith(level('fit-01', 3, 10, 5000), level('fit-02', 2, 20, 7000)),
    );
    const gateway = new FakeGateway();

    const result = await new SyncProgress(new MemorySessions(ADA), spaces, spaces, gateway).execute(
      {
        gameId: FIT,
      },
    );

    const merged = fitWith(level('fit-01', 3, 10, 5000), level('fit-02', 2, 20, 7000));
    expect(result.ok).toBe(true);
    expect(sameContent(gateway.sent[0]!.progress, merged)).toBe(true);
    expect(sameContent(spaces.own.get('fit')!, merged)).toBe(true);
    expect(spaces.anonymous.size).toBe(0);
  });

  it('should_merge_the_anonymous_progress_into_a_new_progress_when_the_account_has_no_local_progress', async () => {
    const spaces = new TwoSpaces();
    spaces.anonymous.set('fit', fitWith(level('fit-01', 3, 10, 5000)));
    const gateway = new FakeGateway();

    await new SyncProgress(new MemorySessions(ADA), spaces, spaces, gateway).execute({
      gameId: FIT,
    });

    expect(sameContent(spaces.own.get('fit')!, fitWith(level('fit-01', 3, 10, 5000)))).toBe(true);
    expect(gateway.sent).toHaveLength(1);
    expect(spaces.anonymous.size).toBe(0);
  });

  it('should_send_nothing_when_the_game_has_no_local_progress', async () => {
    const spaces = new TwoSpaces();
    const gateway = new FakeGateway();

    const result = await new SyncProgress(new MemorySessions(ADA), spaces, spaces, gateway).execute(
      {
        gameId: FIT,
      },
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(gateway.sent).toHaveLength(0);
    expect(spaces.own.size).toBe(0);
  });

  // The token lives 24 hours and has no refresh. A 401 gives `session-expired`, and the screen asks
  // the player to sign in. The local progress stays. `SessionAspect` clears the session (#481).
  it('should_keep_the_session_and_the_local_progress_and_give_session_expired_when_the_backend_refuses_the_token', async () => {
    const spaces = new TwoSpaces();
    const local = fitWith(level('fit-01', 2, 12, 9000));
    spaces.own.set('fit', local);
    const sessions = new MemorySessions(ADA);
    const gateway = new FakeGateway(
      undefined,
      new SyncFailure(FailureCode.sessionExpired, 'POST /v1/progress answered 401.'),
    );

    const result = await new SyncProgress(sessions, spaces, spaces, gateway).execute({
      gameId: FIT,
    });

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.sessionExpired);
    expect(result.ok ? undefined : result.error.message).toBe('POST /v1/progress answered 401.');
    expect(sessions.clears).toBe(0);
    await expect(sessions.read()).resolves.toBe(ADA);
    expect(sameContent(spaces.own.get('fit')!, fitWith(level('fit-01', 2, 12, 9000)))).toBe(true);
  });

  it('should_keep_the_local_progress_and_the_session_and_give_backend_unreachable_when_the_backend_gives_no_answer', async () => {
    const spaces = new TwoSpaces();
    spaces.own.set('fit', fitWith(level('fit-01', 2, 12, 9000)));
    const sessions = new MemorySessions(ADA);
    const gateway = new FakeGateway(
      undefined,
      new SyncFailure(FailureCode.backendUnreachable, 'POST /v1/progress got no answer.'),
    );

    const result = await new SyncProgress(sessions, spaces, spaces, gateway).execute({
      gameId: FIT,
    });

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.backendUnreachable);
    expect(sessions.clears).toBe(0);
    expect(sameContent(spaces.own.get('fit')!, fitWith(level('fit-01', 2, 12, 9000)))).toBe(true);
  });

  // For example a 400 of a level that the backend does not hold (`unknown-level`).
  it('should_keep_the_local_progress_and_give_sync_failed_when_the_gateway_fails_another_way', async () => {
    const spaces = new TwoSpaces();
    spaces.own.set('fit', fitWith(level('fit-01', 2, 12, 9000)));
    const thrown = new Error('POST /v1/progress answered 400.');
    const gateway = new FakeGateway(undefined, thrown);

    const result = await new SyncProgress(new MemorySessions(ADA), spaces, spaces, gateway).execute(
      {
        gameId: FIT,
      },
    );

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.syncFailed);
    expect(result.ok ? undefined : result.error.cause).toBe(thrown);
    expect(sameContent(spaces.own.get('fit')!, fitWith(level('fit-01', 2, 12, 9000)))).toBe(true);
  });

  it('should_keep_the_anonymous_progress_and_give_sync_failed_when_the_merged_progress_cannot_be_saved', async () => {
    const spaces = new TwoSpaces();
    spaces.anonymous.set('fit', fitWith(level('fit-01', 3, 10, 5000)));
    spaces.failSave = true;
    const gateway = new FakeGateway();

    const result = await new SyncProgress(new MemorySessions(ADA), spaces, spaces, gateway).execute(
      {
        gameId: FIT,
      },
    );

    expect(result.ok ? undefined : result.error.code).toBe(FailureCode.syncFailed);
    expect(spaces.anonymous.size).toBe(1);
    expect(gateway.sent).toHaveLength(0);
  });
});
