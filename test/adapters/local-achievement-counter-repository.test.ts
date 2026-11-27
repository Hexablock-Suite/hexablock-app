/** @jest-environment node */
import { LocalAchievementCounterRepository } from '../../src/adapters/local-achievement-counter-repository';
import { AchievementCount } from '../../src/domain/achievements/achievement-count';
import { AchievementCounters } from '../../src/domain/achievements/achievement-counters';
import { GameId } from '../../src/domain/shared/game-id';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { describeAchievementCounterRepositoryContract } from '../support/contracts/achievement-counter-repository-contract';
import { countsOf } from '../support/engine/counters-content';

// Issue #363 (part 3 of #277): the local adapter of the `AchievementCounterRepository` port
// runs the contract suite of the port over the in-memory `KeyValueStore` of the integration tests.
describeAchievementCounterRepositoryContract(
  'LocalAchievementCounterRepository',
  () => new LocalAchievementCounterRepository(new InMemoryKeyValueStore()),
);

const LINES = GameId.of('hexa-lines');
const SORT = GameId.of('hexa-sort');
const INVALID = 'The saved counters of the achievements of a game are not valid.';
const UNKNOWN_VERSION =
  'The saved counters of the achievements of a game have a version that this app does not read.';

function countersOf(gameId: GameId, best: number, total: number): AchievementCounters {
  const counters = AchievementCounters.start(gameId);
  counters.recordBest(AchievementCount.of(best));
  counters.addToTotal(AchievementCount.of(total));
  return counters;
}

// Loads the counters of Hexa Lines from a store that holds `text`. It gives the error of the
// load and the text that the store keeps after it.
async function loadFrom(text: string): Promise<{ error: unknown; kept: string | undefined }> {
  const store = new InMemoryKeyValueStore();
  await store.set('achievement-counters:hexa-lines', text);
  let error: unknown;
  try {
    await new LocalAchievementCounterRepository(store).load(LINES);
  } catch (thrown) {
    error = thrown;
  }
  return { error, kept: await store.get('achievement-counters:hexa-lines') };
}

// The class and the message of an error, as plain data.
const refusal = (error: unknown) =>
  error instanceof Error ? [error.constructor.name, error.message] : error;

describe('LocalAchievementCounterRepository', () => {
  // The counters of a game are their own aggregate, so they have their own key next to
  // `progress:<game id>`, and the saved progress of #164 does not change.
  it('should_save_plain_numbers_with_a_version_under_the_key_of_the_game_when_counters_are_saved', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new LocalAchievementCounterRepository(store);

    await repository.save(countersOf(LINES, 3, 0));
    await repository.save(countersOf(SORT, 0, 10));

    await expect(store.get('achievement-counters:hexa-lines')).resolves.toBe(
      '{"version":1,"best":3,"total":0}',
    );
    await expect(store.get('achievement-counters:hexa-sort')).resolves.toBe(
      '{"version":1,"best":0,"total":10}',
    );
    await expect(store.get('progress:hexa-lines')).resolves.toBeUndefined();
  });

  // A restart of the app builds the repository again over the same store.
  it('should_give_back_the_saved_counters_when_a_new_repository_reads_the_same_store', async () => {
    const store = new InMemoryKeyValueStore();

    await new LocalAchievementCounterRepository(store).save(countersOf(SORT, 0, 10));
    const loaded = await new LocalAchievementCounterRepository(store).load(SORT);

    expect(countsOf(loaded)).toEqual({ best: 0, total: 10 });
  });

  it('should_refuse_the_saved_counters_and_keep_the_text_when_the_version_is_missing_or_unknown', async () => {
    for (const text of [
      '{"best":3,"total":0}',
      '{"version":2,"best":3,"total":0}',
      '{"version":"1","best":3,"total":0}',
    ]) {
      const { error, kept } = await loadFrom(text);

      expect(refusal(error)).toEqual(['RangeError', UNKNOWN_VERSION]);
      expect(kept).toBe(text);
    }
  });

  it('should_refuse_the_saved_counters_and_keep_the_text_when_a_part_has_the_wrong_type', async () => {
    for (const text of [
      'null',
      '[]',
      '3',
      '{"version":1}',
      '{"version":1,"best":3}',
      '{"version":1,"total":0}',
      '{"version":1,"best":"3","total":0}',
      '{"version":1,"best":3,"total":null}',
    ]) {
      const { error, kept } = await loadFrom(text);

      expect(refusal(error)).toEqual(['RangeError', INVALID]);
      expect(kept).toBe(text);
    }
  });

  it('should_refuse_the_saved_counters_and_keep_the_text_when_a_value_breaks_the_rule_of_its_value_object', async () => {
    const texts = ['{"version":1,"best":-1,"total":0}', '{"version":1,"best":0,"total":2.5}'];

    const loads = await Promise.all(texts.map(loadFrom));

    expect(loads.map(({ error }) => refusal(error))).toEqual([
      ['RangeError', 'A count of an achievement needs a whole number of 0 or more, not -1.'],
      ['RangeError', 'A count of an achievement needs a whole number of 0 or more, not 2.5.'],
    ]);
    expect(loads.map(({ kept }) => kept)).toEqual(texts);
  });

  it('should_refuse_the_saved_counters_when_the_saved_text_is_not_json', async () => {
    const { error, kept } = await loadFrom('not json');

    expect(error).toBeInstanceOf(SyntaxError);
    expect(kept).toBe('not json');
  });
});
