/** @jest-environment node */
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { SessionManager } from '../../src/adapters/session-manager';
import { ProgressOwner } from '../../src/application/progress-owner';
import { Session } from '../../src/application/session';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { Moves } from '../../src/domain/shared/moves';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { Stars } from '../../src/domain/progress/stars';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import { saveIn } from '../support/adapters/saved-progress';
import { describeProgressRepositoryContract } from '../support/contracts/progress-repository-contract';
import { sameContent } from '../support/engine/progress-content';

// Issue #164: the local adapter of the `ProgressRepository` port runs the contract suite
// of the port over the in-memory `KeyValueStore` of the integration tests (APP-NFR-15).
describeProgressRepositoryContract(
  'LocalProgressRepository',
  () => new LocalProgressRepository(new InMemoryKeyValueStore()),
);
// #46 (D27): with a signed-in player the repository keeps the progress of that account,
// and it still keeps the rules of its port.
describeProgressRepositoryContract(
  'LocalProgressRepository with a signed-in player',
  () => new LocalProgressRepository(new InMemoryKeyValueStore(), signedIn(ADA)),
);

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');
const INVALID = 'The saved progress of a game is not valid.';
const UNKNOWN_VERSION = 'The saved progress of a game has a version that this app does not read.';

// The record of one play of the level `level` of Hexa Fit. A level with no timer gives no time.
const levelRecord = (level: string, stars: number, moves: number, ms?: number) =>
  ProgressRecord.of({
    gameId: FIT,
    score: Score.of(0),
    levelId: LevelId.of(level),
    stars: Stars.of(stars),
    moves: Moves.of(moves),
    elapsedMs: ms === undefined ? undefined : ElapsedTime.ofMs(ms),
  });

const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const GRACE = new Session('token-of-grace', '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f');

// A session manager over a new secure store that keeps `session`.
function signedIn(session: Session): SessionManager {
  const sessions = new SessionManager(new InMemorySecretStore());
  void sessions.write(session);
  return sessions;
}

function fitWith(...records: ProgressRecord[]): GameProgress {
  const progress = GameProgress.start(FIT);
  for (const record of records) progress.recordLevel(record);
  return progress;
}

// #46 (D27): the local key carries the owner, so two accounts on one device do not share progress.
// The progress saved with no account stays under the key of the game: the anonymous space.
describe('LocalProgressRepository and the owner of the progress', () => {
  const ADA_OWNER = ProgressOwner.of(ADA.userId);
  const SAVED_FIT_01 =
    '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":3,"moves":10}]}';
  const SAVED_FIT_02 =
    '{"version":1,"levels":[{"score":0,"levelId":"fit-02","stars":1,"moves":40}]}';

  // A store whose writes reject once `failing` is set, as a full disk does.
  class FullDisk extends InMemoryKeyValueStore {
    failing = false;
    override set(key: string, value: string): Promise<void> {
      if (this.failing) return Promise.reject(new Error('The disk is full.'));
      return super.set(key, value);
    }
  }

  it('should_save_under_the_key_of_the_account_and_the_game_when_the_owner_is_a_user', async () => {
    const store = new InMemoryKeyValueStore();

    await saveIn(
      new LocalProgressRepository(store),
      fitWith(levelRecord('fit-01', 3, 10)),
      ADA_OWNER,
    );

    await expect(store.get(`progress:${ADA.userId}:hexa-fit`)).resolves.toBe(SAVED_FIT_01);
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  it('should_save_under_the_key_of_the_game_when_the_owner_is_anonymous', async () => {
    const store = new InMemoryKeyValueStore();

    await saveIn(new LocalProgressRepository(store), fitWith(levelRecord('fit-01', 3, 10)));

    await expect(store.get('progress:hexa-fit')).resolves.toBe(SAVED_FIT_01);
  });

  it('should_give_the_user_of_the_session_as_the_owner_when_a_player_signed_in', async () => {
    await expect(
      new LocalProgressRepository(new InMemoryKeyValueStore(), signedIn(ADA)).owner(),
    ).resolves.toEqual(ADA_OWNER);
  });

  // Judgment-day round 1, F3: a refused token clears the token only, so the owner stays.
  it('should_keep_the_user_as_the_owner_when_the_session_is_cleared', async () => {
    const sessions = signedIn(ADA);
    await sessions.clear();

    await expect(
      new LocalProgressRepository(new InMemoryKeyValueStore(), sessions).owner(),
    ).resolves.toEqual(ADA_OWNER);
  });

  it('should_give_the_anonymous_owner_when_no_player_signed_in', async () => {
    const sessions = new SessionManager(new InMemorySecretStore());

    await expect(
      new LocalProgressRepository(new InMemoryKeyValueStore(), sessions).owner(),
    ).resolves.toBe(ProgressOwner.anonymous);
    await expect(new LocalProgressRepository(new InMemoryKeyValueStore()).owner()).resolves.toBe(
      ProgressOwner.anonymous,
    );
  });

  // The web build has no secure storage, so each read of the session rejects there (#45).
  // `SaveProgress` and `ListLevels` need no session (D27), so the repository uses the anonymous
  // owner then.
  it('should_give_the_anonymous_owner_when_the_session_cannot_be_read', async () => {
    const secrets = new InMemorySecretStore();
    await secrets.set('session', 'not json');

    await expect(
      new LocalProgressRepository(new InMemoryKeyValueStore(), new SessionManager(secrets)).owner(),
    ).resolves.toBe(ProgressOwner.anonymous);
  });

  it('should_give_no_progress_of_another_account_when_a_second_player_owns_the_progress', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new LocalProgressRepository(store);
    await saveIn(repository, fitWith(levelRecord('fit-01', 3, 10)), ADA_OWNER);

    const loaded = await repository.load(ProgressOwner.of(GRACE.userId), FIT);

    expect(loaded).toBeUndefined();
  });

  // D27: the progress played with no account merges into the first account that signs in.
  it('should_merge_the_anonymous_progress_into_the_progress_of_the_user_and_forget_it_when_it_is_merged', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new LocalProgressRepository(store);
    await store.set(`progress:${ADA.userId}:hexa-fit`, SAVED_FIT_01);
    await store.set('progress:hexa-fit', SAVED_FIT_02);

    await repository.mergeAnonymousInto(ADA_OWNER, FIT);

    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
    const own = await repository.load(ADA_OWNER, FIT);
    expect(
      own !== undefined &&
        sameContent(own, fitWith(levelRecord('fit-01', 3, 10), levelRecord('fit-02', 1, 40))),
    ).toBe(true);
  });

  // Judgment-day round 1, F4: the anonymous progress is forgotten only after the merged progress
  // is saved.
  it('should_keep_the_anonymous_progress_when_the_merged_progress_cannot_be_saved', async () => {
    const store = new FullDisk();
    await store.set('progress:hexa-fit', SAVED_FIT_02);
    store.failing = true;
    const repository = new LocalProgressRepository(store);

    await expect(repository.mergeAnonymousInto(ADA_OWNER, FIT)).rejects.toThrow(
      'The disk is full.',
    );

    await expect(store.get('progress:hexa-fit')).resolves.toBe(SAVED_FIT_02);
    await expect(store.get(`progress:${ADA.userId}:hexa-fit`)).resolves.toBeUndefined();
  });

  it('should_change_nothing_when_the_anonymous_progress_merges_into_the_anonymous_owner', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('progress:hexa-fit', SAVED_FIT_02);

    await new LocalProgressRepository(store).mergeAnonymousInto(ProgressOwner.anonymous, FIT);

    await expect(store.get('progress:hexa-fit')).resolves.toBe(SAVED_FIT_02);
  });

  // F3: a device that signed in under #45 kept its progress in the anonymous space. The first load
  // of a user whose key is empty merges it into that key.
  it('should_give_the_anonymous_progress_to_the_user_when_the_key_of_the_user_is_empty', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('progress:hexa-fit', SAVED_FIT_02);

    const loaded = await new LocalProgressRepository(store).load(ADA_OWNER, FIT);

    expect(loaded !== undefined && sameContent(loaded, fitWith(levelRecord('fit-02', 1, 40)))).toBe(
      true,
    );
    await expect(store.get(`progress:${ADA.userId}:hexa-fit`)).resolves.toBe(SAVED_FIT_02);
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  it('should_keep_the_anonymous_progress_apart_when_the_key_of_the_user_holds_progress', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('progress:hexa-fit', SAVED_FIT_02);
    await store.set(`progress:${ADA.userId}:hexa-fit`, SAVED_FIT_01);

    const loaded = await new LocalProgressRepository(store).load(ADA_OWNER, FIT);

    expect(loaded !== undefined && sameContent(loaded, fitWith(levelRecord('fit-01', 3, 10)))).toBe(
      true,
    );
    await expect(store.get('progress:hexa-fit')).resolves.toBe(SAVED_FIT_02);
  });
});

describe('LocalProgressRepository', () => {
  // S3-04 (#151): one object per game with the high score and the per-level results.
  // The saved JSON holds plain numbers and texts, and a missing value has no field.
  it('should_save_plain_numbers_and_texts_under_the_key_of_the_game_when_a_progress_is_saved', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new LocalProgressRepository(store);
    const fit = GameProgress.start(FIT);
    fit.recordLevel(levelRecord('fit-02', 1, 40, 9000));
    fit.recordLevel(levelRecord('fit-01', 3, 10));
    const lines = GameProgress.start(LINES);
    lines.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));

    await saveIn(repository, fit);
    await saveIn(repository, lines);

    await expect(store.get('progress:hexa-fit')).resolves.toBe(
      '{"version":1,"levels":[' +
        '{"score":0,"levelId":"fit-02","stars":1,"moves":40,"elapsedMs":9000},' +
        '{"score":0,"levelId":"fit-01","stars":3,"moves":10}]}',
    );
    await expect(store.get('progress:hexa-lines')).resolves.toBe(
      '{"version":1,"highScore":{"score":36},"levels":[]}',
    );
  });

  // APP-NFR-15: the progress survives a restart of the app.
  it('should_give_back_the_saved_progress_when_a_new_repository_reads_the_same_store', async () => {
    const store = new InMemoryKeyValueStore();
    const saved = GameProgress.start(FIT);
    saved.recordLevel(levelRecord('fit-01', 2, 12, 3000));

    await saveIn(new LocalProgressRepository(store), saved);
    const loaded = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT);

    expect(loaded !== undefined && sameContent(loaded, saved)).toBe(true);
  });

  // A record of the store is the best result of its level (DS-12). The repository gives it to
  // the progress with `recordLevel()`, so a store with two records of one level keeps the best.
  it('should_keep_the_best_result_of_a_level_when_the_store_holds_two_results_of_the_level', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set(
      'progress:hexa-fit',
      '{"version":1,"levels":[' +
        '{"score":0,"levelId":"fit-01","stars":1,"moves":9},' +
        '{"score":0,"levelId":"fit-01","stars":3,"moves":20}]}',
    );

    const loaded = await new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT);

    expect(loaded?.keeps(levelRecord('fit-01', 3, 20))).toBe(true);
    expect(loaded?.keeps(levelRecord('fit-01', 1, 9))).toBe(false);
  });

  it('should_refuse_the_saved_progress_when_its_version_is_missing_or_unknown', async () => {
    for (const text of ['{"levels":[]}', '{"version":2,"levels":[]}', '{"version":"1"}']) {
      const store = new InMemoryKeyValueStore();
      await store.set('progress:hexa-fit', text);

      await expect(
        new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT),
      ).rejects.toThrow(new RangeError(UNKNOWN_VERSION));
    }
  });

  it('should_refuse_the_saved_progress_when_a_part_of_it_has_the_wrong_type', async () => {
    const texts = [
      'null',
      '[]',
      '{"version":1}',
      '{"version":1,"levels":{}}',
      '{"version":1,"levels":[null]}',
      '{"version":1,"levels":[{}]}',
      '{"version":1,"levels":[{"score":"12"}]}',
      '{"version":1,"levels":[{"score":0,"levelId":3}]}',
      '{"version":1,"levels":[{"score":0,"levelId":"l1","stars":"3"}]}',
      '{"version":1,"levels":[{"score":0,"levelId":"l1","moves":null}]}',
      '{"version":1,"levels":[{"score":0,"levelId":"l1","elapsedMs":[]}]}',
      '{"version":1,"highScore":36,"levels":[]}',
    ];
    for (const text of texts) {
      const store = new InMemoryKeyValueStore();
      await store.set('progress:hexa-fit', text);

      await expect(
        new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT),
      ).rejects.toThrow(new RangeError(INVALID));
    }
  });

  // Each value object checks its own value (classes.md decisions 41 and 42).
  it('should_refuse_the_saved_progress_when_a_value_breaks_the_rule_of_its_value_object', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set(
      'progress:hexa-fit',
      '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":-1,"moves":9}]}',
    );

    await expect(
      new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT),
    ).rejects.toThrow(new RangeError('A star count needs a whole number of 0 or more, not -1.'));
  });

  it('should_refuse_the_saved_progress_when_the_saved_text_is_not_json', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('progress:hexa-fit', 'not json');

    await expect(
      new LocalProgressRepository(store).load(ProgressOwner.anonymous, FIT),
    ).rejects.toThrow(SyntaxError);
  });
});
