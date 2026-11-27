import type { SecretStore } from '../../../src/adapters/secret-store';

// The contract of the driver interface `SecretStore` of layer 3 (layers.md, issue #45).
// The test fake and every driver of the interface run the same suite, so they behave the same.
// `make()` gives a new, empty store for each test. Each key holds only the characters that the
// interface allows.
export function describeSecretStoreContract(name: string, make: () => SecretStore): void {
  describe(`${name} as a SecretStore`, () => {
    it('should_give_no_value_when_the_key_holds_no_value', async () => {
      await expect(make().get('session')).resolves.toBeUndefined();
    });

    it('should_give_back_the_kept_value_when_a_value_is_kept_under_the_key', async () => {
      const store = make();

      await store.set('session', '{"token":"a"}');

      await expect(store.get('session')).resolves.toBe('{"token":"a"}');
    });

    it('should_give_back_the_last_value_when_a_second_value_replaces_the_first', async () => {
      const store = make();

      await store.set('session', 'first');
      await store.set('session', 'second');

      await expect(store.get('session')).resolves.toBe('second');
    });

    it('should_keep_each_value_under_its_own_key_when_two_keys_hold_values', async () => {
      const store = make();

      await store.set('session', 'a');
      await store.set('session.backup_1', 'b');

      await expect(store.get('session')).resolves.toBe('a');
      await expect(store.get('session.backup_1')).resolves.toBe('b');
      await expect(store.get('session-other')).resolves.toBeUndefined();
    });
  });
}
