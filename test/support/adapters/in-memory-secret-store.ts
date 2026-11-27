import type { SecretStore } from '../../../src/adapters/secret-store';

// A `SecretStore` in memory (issue #45). It exists only in test/: the tests of the session run
// the real `SessionManager` over it, with no device.
// Each store keeps its own values, and they disappear with the store.
export class InMemorySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(key));
  }

  set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}
