/** @jest-environment node */
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { SessionManager } from '../../src/adapters/session-manager';
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

// #46 (D27): the local key carries the user, so two accounts on one device do not share progress.
// The progress saved with no account stays under the key of the game: the anonymous space.
describe('LocalProgressRepository and the account of the session', () => {
  it('should_save_under_the_key_of_the_account_and_the_game_when_a_player_signed_in', async () => {
    const store = new InMemoryKeyValueStore();

    await new LocalProgressRepository(store, signedIn(ADA)).save(
      fitWith(levelRecord('fit-01', 3, 10)),
    );

    await expect(store.get(`progress:${ADA.userId}:hexa-fit`)).resolves.toBe(
      '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":3,"moves":10}]}',
    );
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  it('should_save_under_the_key_of_the_game_when_no_player_signed_in', async () => {
    const store = new InMemoryKeyValueStore();
    const sessions = new SessionManager(new InMemorySecretStore());

    await new LocalProgressRepository(store, sessions).save(fitWith(levelRecord('fit-01', 3, 10)));

    await expect(store.get('progress:hexa-fit')).resolves.toBe(
      '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":3,"moves":10}]}',
    );
  });

  // The web build has no secure storage, so each read of the session rejects there (#45).
  // `SaveProgress` and `ListLevels` need no session (D27), so the repository uses the anonymous
  // space then.
  it('should_use_the_key_of_the_game_when_the_session_cannot_be_read', async () => {
    const store = new InMemoryKeyValueStore();
    const secrets = new InMemorySecretStore();
    await secrets.set('session', 'not json');
    const repository = new LocalProgressRepository(store, new SessionManager(secrets));

    await repository.save(fitWith(levelRecord('fit-01', 3, 10)));
    const loaded = await repository.load(FIT);

    await expect(store.get('progress:hexa-fit')).resolves.toBe(
      '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":3,"moves":10}]}',
    );
    expect(loaded !== undefined && sameContent(loaded, fitWith(levelRecord('fit-01', 3, 10)))).toBe(
      true,
    );
  });

  it('should_give_no_progress_of_another_account_when_a_second_player_signs_in_on_the_device', async () => {
    const store = new InMemoryKeyValueStore();
    await new LocalProgressRepository(store, signedIn(ADA)).save(
      fitWith(levelRecord('fit-01', 3, 10)),
    );
    await new LocalProgressRepository(store).save(fitWith(levelRecord('fit-02', 1, 40)));

    const loaded = await new LocalProgressRepository(store, signedIn(GRACE)).load(FIT);

    expect(loaded).toBeUndefined();
  });

  it('should_give_the_progress_saved_with_no_account_when_a_signed_in_player_loads_the_anonymous_progress', async () => {
    const store = new InMemoryKeyValueStore();
    await new LocalProgressRepository(store).save(fitWith(levelRecord('fit-02', 1, 40)));
    const repository = new LocalProgressRepository(store, signedIn(ADA));

    const anonymous = await repository.loadAnonymous(FIT);

    expect(
      anonymous !== undefined && sameContent(anonymous, fitWith(levelRecord('fit-02', 1, 40))),
    ).toBe(true);
    await expect(repository.load(FIT)).resolves.toBeUndefined();
  });

  it('should_give_no_anonymous_progress_and_keep_the_account_progress_when_the_anonymous_progress_is_forgotten', async () => {
    const store = new InMemoryKeyValueStore();
    await new LocalProgressRepository(store).save(fitWith(levelRecord('fit-02', 1, 40)));
    const repository = new LocalProgressRepository(store, signedIn(ADA));
    await repository.save(fitWith(levelRecord('fit-01', 3, 10)));

    await repository.forgetAnonymous(FIT);

    await expect(repository.loadAnonymous(FIT)).resolves.toBeUndefined();
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
    const own = await repository.load(FIT);
    expect(own !== undefined && sameContent(own, fitWith(levelRecord('fit-01', 3, 10)))).toBe(true);
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

    await repository.save(fit);
    await repository.save(lines);

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

    await new LocalProgressRepository(store).save(saved);
    const loaded = await new LocalProgressRepository(store).load(FIT);

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

    const loaded = await new LocalProgressRepository(store).load(FIT);

    expect(loaded?.keeps(levelRecord('fit-01', 3, 20))).toBe(true);
    expect(loaded?.keeps(levelRecord('fit-01', 1, 9))).toBe(false);
  });

  it('should_refuse_the_saved_progress_when_its_version_is_missing_or_unknown', async () => {
    for (const text of ['{"levels":[]}', '{"version":2,"levels":[]}', '{"version":"1"}']) {
      const store = new InMemoryKeyValueStore();
      await store.set('progress:hexa-fit', text);

      await expect(new LocalProgressRepository(store).load(FIT)).rejects.toThrow(
        new RangeError(UNKNOWN_VERSION),
      );
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

      await expect(new LocalProgressRepository(store).load(FIT)).rejects.toThrow(
        new RangeError(INVALID),
      );
    }
  });

  // Each value object checks its own value (classes.md decisions 41 and 42).
  it('should_refuse_the_saved_progress_when_a_value_breaks_the_rule_of_its_value_object', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set(
      'progress:hexa-fit',
      '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":-1,"moves":9}]}',
    );

    await expect(new LocalProgressRepository(store).load(FIT)).rejects.toThrow(
      new RangeError('A star count needs a whole number of 0 or more, not -1.'),
    );
  });

  it('should_refuse_the_saved_progress_when_the_saved_text_is_not_json', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('progress:hexa-fit', 'not json');

    await expect(new LocalProgressRepository(store).load(FIT)).rejects.toThrow(SyntaxError);
  });
});
