import type { KeyValueStore } from '../../../src/adapters/key-value-store';

// A `KeyValueStore` in memory (issue #155). It exists only in test/: the integration tests
// of APP-NFR-15 run the real local repositories over it, with no device.
// Each store keeps its own values, and they disappear with the store.
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(key));
  }

  set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}
