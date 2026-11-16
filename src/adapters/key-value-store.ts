// The driver interface of the local storage (layers.md, classes.md decision 25, issue #155).
// Layer 3 owns it, and the local repositories of layer 3 use it.
// A driver of layer 4 implements it, so no adapter imports a storage package.
// It is not a port: layer 2 does not own it.
// It keeps one text value for each text key.
export interface KeyValueStore {
  // The value saved under the key, or `undefined` when the key holds no value.
  get(key: string): Promise<string | undefined>;
  // Saves the value under the key. It replaces the value that the key held before.
  set(key: string, value: string): Promise<void>;
}
