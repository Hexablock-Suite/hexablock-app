import type { KeyValueStore } from '../../../src/adapters/key-value-store';

// The contract of the driver interface `KeyValueStore` of layer 3 (layers.md, issue #155).
// The test fake and every driver of the interface run the same suite, so they behave the same.
// `make()` gives a new, empty store for each test.
export function describeKeyValueStoreContract(name: string, make: () => KeyValueStore): void {
  describe(`${name} as a KeyValueStore`, () => {
    it('should_give_no_value_when_the_key_holds_no_value', async () => {
      await expect(make().get('progress:hexa-fit')).resolves.toBeUndefined();
    });

    it('should_give_back_the_saved_value_when_a_value_is_saved_under_the_key', async () => {
      const store = make();

      await store.set('progress:hexa-fit', '{"level":3}');

      await expect(store.get('progress:hexa-fit')).resolves.toBe('{"level":3}');
    });

    it('should_give_back_the_last_value_when_a_second_value_replaces_the_first', async () => {
      const store = make();

      await store.set('settings:language', 'es');
      await store.set('settings:language', 'en');

      await expect(store.get('settings:language')).resolves.toBe('en');
    });

    // #46: the progress saved with no account goes away when it merges into an account (D27).
    it('should_give_no_value_and_keep_the_other_keys_when_the_value_of_a_key_is_removed', async () => {
      const store = make();
      await store.set('progress:hexa-fit', '{"level":3}');
      await store.set('progress:hexa-sort', '{"level":5}');

      await store.remove('progress:hexa-fit');

      await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
      await expect(store.get('progress:hexa-sort')).resolves.toBe('{"level":5}');
    });

    it('should_change_nothing_when_a_key_with_no_value_is_removed', async () => {
      const store = make();
      await store.set('progress:hexa-sort', '{"level":5}');

      await store.remove('progress:hexa-fit');

      await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
      await expect(store.get('progress:hexa-sort')).resolves.toBe('{"level":5}');
    });

    it('should_keep_each_value_under_its_own_key_when_two_keys_hold_values', async () => {
      const store = make();

      await store.set('progress:hexa-fit', '{"level":3}');
      await store.set('progress:hexa-sort', '{"level":5}');

      await expect(store.get('progress:hexa-fit')).resolves.toBe('{"level":3}');
      await expect(store.get('progress:hexa-sort')).resolves.toBe('{"level":5}');
    });

    it('should_keep_each_value_under_its_own_key_when_one_key_is_a_prefix_of_another', async () => {
      const store = make();

      await store.set('progress', 'a');
      await store.set('progress:hexa-fit', 'b');

      await expect(store.get('progress')).resolves.toBe('a');
      await expect(store.get('progress:hexa-fit')).resolves.toBe('b');
      await expect(store.get('progress:hexa-sort')).resolves.toBeUndefined();
    });
  });
}
