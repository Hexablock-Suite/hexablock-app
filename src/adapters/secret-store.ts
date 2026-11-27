// The driver interface of the secure storage of the device (layers.md, issue #45, issue #437).
// Layer 3 owns it, and `SessionManager` of layer 3 keeps the session through it.
// A driver of layer 4 implements it, so no adapter imports a storage package.
// It is not a port: layer 2 does not own it.
// It keeps one secret text value for each key. A key holds only letters, digits, `.`, `-` and
// `_`, the keys that the secure storage of the phone accepts.
export interface SecretStore {
  // The value kept under the key, or `undefined` when the key holds no value.
  get(key: string): Promise<string | undefined>;
  // Keeps the value under the key. It replaces the value that the key held before.
  set(key: string, value: string): Promise<void>;
  // Forgets the value of the key. A key with no value changes nothing (issue #46).
  remove(key: string): Promise<void>;
}
